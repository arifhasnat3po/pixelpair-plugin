<?php
/** Legacy identity migration fixtures. @package PixelPair */

use PixelPair\Settings\Migrations;
use PixelPair\Support\Crypto;

final class LegacyMigrationTest extends LifecycleTestCase {
	private $legacy_options = array();

	protected function setUp(): void {
		parent::setUp();
		foreach ( array( 'tagpilot_settings', 'tagpilot_secrets', 'tagpilot_tiktok_secrets', 'tagpilot_db_version', 'tagpilot_identity_probe', 'pixelpair_identity_probe', 'pixelpair_identity_version', 'pixelpair_legacy_batch_done', 'pixelpair_secrets', 'pixelpair_tiktok_secrets', 'pixelpair_legacy_meta_groups', 'pixelpair_legacy_queue_cursor' ) as $key ) {
			$this->legacy_options[ $key ] = get_option( $key, null );
			delete_option( $key );
		}
	}

	protected function tearDown(): void {
		foreach ( $this->legacy_options as $key => $value ) {
			delete_option( $key );
			if ( null !== $value ) { add_option( $key, $value, '', false ); }
		}
		wp_clear_scheduled_hook( 'pixelpair_legacy_migrate' );
		parent::tearDown();
	}

	public static function legacy_encrypt( string $plain ): string {
		$context = 'tagpilot:' . get_current_blog_id();
		$key = hash( 'sha256', AUTH_KEY . SECURE_AUTH_SALT . $context, true );
		$iv = random_bytes( 12 ); $tag = '';
		$cipher = openssl_encrypt( $plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, $context );
		return 'v1:' . base64_encode( $iv . $tag . $cipher );
	}

	public function test_options_ciphertext_destination_precedence_and_repeat_run(): void {
		$secret = wp_generate_password( 32, false );
		add_option( 'tagpilot_identity_probe', 'legacy', '', false );
		add_option( 'pixelpair_identity_probe', 'current', '', false );
		add_option( 'tagpilot_secrets', array( 'token' => self::legacy_encrypt( $secret ) ), '', false );
		add_option( 'tagpilot_settings', array( 'meta_enabled' => true, 'google_data_layer' => 'tagpilotDataLayer', 'gtm_data_layer' => 'customLayer' ), '', true );
		$this->assertTrue( Migrations::identity() );
		$this->assertSame( 'current', get_option( 'pixelpair_identity_probe' ) );
		$this->assertFalse( get_option( 'tagpilot_identity_probe' ) );
		$this->assertSame( $secret, Crypto::decrypt( get_option( 'pixelpair_secrets' )['token'] ) );
		$this->assertFalse( get_option( 'tagpilot_secrets' ) );
		$this->assertSame( 'pixelpairDataLayer', get_option( 'pixelpair_settings' )['google_data_layer'] );
		$this->assertSame( 'customLayer', get_option( 'pixelpair_settings' )['gtm_data_layer'] );
		$before = get_option( 'pixelpair_secrets' );
		$this->assertTrue( Migrations::identity() );
		$this->assertSame( $before, get_option( 'pixelpair_secrets' ) );
	}

	public function test_roles_and_cron_move_without_duplicate_events(): void {
		$role = add_role( 'legacy_migration_role', 'Legacy migration role', array( 'read' => true, 'manage_tagpilot' => true ) );
		$when = time() + 500; $args = array( 987654 );
		wp_schedule_single_event( $when, 'tagpilot_woo_purchase', $args );
		try {
			Migrations::identity(); Migrations::identity();
			$this->assertTrue( get_role( 'legacy_migration_role' )->has_cap( 'manage_pixelpair' ) );
			$this->assertFalse( get_role( 'legacy_migration_role' )->has_cap( 'manage_tagpilot' ) );
			$this->assertFalse( wp_next_scheduled( 'tagpilot_woo_purchase', $args ) );
			$this->assertSame( $when, wp_next_scheduled( 'pixelpair_woo_purchase', $args ) );
			$this->assertFalse( get_role( 'subscriber' )->has_cap( 'manage_pixelpair' ) );
		} finally { remove_role( 'legacy_migration_role' ); wp_clear_scheduled_hook( 'tagpilot_woo_purchase', $args ); wp_clear_scheduled_hook( 'pixelpair_woo_purchase', $args ); }
	}

	public function test_owned_table_and_event_identity_survive_repeated_migration(): void {
		global $wpdb; $old = $wpdb->prefix . 'tagpilot_identity_probe'; $new = $wpdb->prefix . 'pixelpair_identity_probe';
		$wpdb->query( "CREATE TABLE $old (id bigint NOT NULL, value varchar(100) NOT NULL)" );
		$id = wp_generate_uuid4(); $wpdb->insert( $old, array( 'id' => 1, 'value' => $id ) );
		try {
			$this->assertTrue( Migrations::identity() ); Migrations::identity();
			$this->assertSame( $id, $wpdb->get_var( "SELECT value FROM $new WHERE id=1" ) );
			$this->assertNull( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $old ) ) ) );
		} finally { $wpdb->query( "DROP TABLE IF EXISTS $old" ); $wpdb->query( "DROP TABLE IF EXISTS $new" ); }
	}

	public function test_table_collision_retains_both_copies_and_does_not_mark_complete(): void {
		global $wpdb; $old = $wpdb->prefix . 'tagpilot_identity_probe'; $new = $wpdb->prefix . 'pixelpair_identity_probe';
		foreach ( array( $old, $new ) as $table ) { $wpdb->query( "CREATE TABLE $table (id bigint NOT NULL)" ); $wpdb->insert( $table, array( 'id' => 1 ) ); }
		try {
			$this->assertFalse( Migrations::identity() );
			$this->assertSame( '1', (string) $wpdb->get_var( "SELECT COUNT(*) FROM $old" ) );
			$this->assertSame( '1', (string) $wpdb->get_var( "SELECT COUNT(*) FROM $new" ) );
			$this->assertNotSame( '1', get_option( 'pixelpair_identity_version' ) );
		} finally { $wpdb->query( "DROP TABLE IF EXISTS $old" ); $wpdb->query( "DROP TABLE IF EXISTS $new" ); }
	}

	public function test_metadata_batches_preserve_new_values_and_user_data(): void {
		$post = wp_insert_post( array( 'post_title' => 'Migration fixture', 'post_status' => 'draft' ) );
		$user = get_users( array( 'role' => 'subscriber', 'number' => 1 ) )[0]->ID;
		try {
			for ( $i = 0; $i < 205; ++$i ) { add_post_meta( $post, '_tagpilot_probe_' . $i, array( 'value' => $i ) ); }
			add_post_meta( $post, '_pixelpair_probe_0', 'new wins' ); add_user_meta( $user, '_tagpilot_probe', 'user value' );
			Migrations::identity(); Migrations::batch();
			$this->assertSame( 'new wins', get_post_meta( $post, '_pixelpair_probe_0', true ) );
			for ( $n = 0; $n < 6; ++$n ) { Migrations::batch(); }
			$this->assertSame( array( 'value' => 204 ), get_post_meta( $post, '_pixelpair_probe_204', true ) );
			$this->assertSame( '', get_post_meta( $post, '_tagpilot_probe_204', true ) );
			$this->assertSame( 'user value', get_user_meta( $user, '_pixelpair_probe', true ) );
			$this->assertSame( '', get_user_meta( $user, '_tagpilot_probe', true ) );
			Migrations::batch(); $this->assertSame( 'user value', get_user_meta( $user, '_pixelpair_probe', true ) );
		} finally { wp_delete_post( $post, true ); delete_user_meta( $user, '_tagpilot_probe' ); delete_user_meta( $user, '_pixelpair_probe' ); }
	}

	public function test_legacy_cookie_identity_is_retained_and_platform_cookies_unchanged(): void {
		$visitor = bin2hex( random_bytes( 16 ) );
		$_COOKIE = array( 'tagpilot_visitor' => $visitor, '_fbp' => 'fb.1.1234567890123.123456', '_fbc' => 'fb.1.1234567890123.click', '_tagpilot_custom' => 'legacy' );
		Migrations::cookies();
		$this->assertSame( $visitor, $_COOKIE['pixelpair_visitor'] );
		$this->assertArrayNotHasKey( 'tagpilot_visitor', $_COOKIE );
		$this->assertSame( 'legacy', $_COOKIE['_pixelpair_custom'] );
		$this->assertSame( 'fb.1.1234567890123.123456', $_COOKIE['_fbp'] );
		$this->assertSame( 'fb.1.1234567890123.click', $_COOKIE['_fbc'] );
		$after = $_COOKIE; Migrations::cookies(); $this->assertSame( $after, $_COOKIE );
	}

	public function test_failed_destination_write_retains_the_source_for_retry(): void {
		add_option( 'tagpilot_identity_probe', 'keep this copy', '', false );
		$reject = static function () { delete_option( 'pixelpair_identity_probe' ); };
		add_action( 'add_option_pixelpair_identity_probe', $reject );
		try {
			$this->assertFalse( Migrations::identity() );
			$this->assertSame( 'keep this copy', get_option( 'tagpilot_identity_probe' ) );
			$this->assertFalse( get_option( 'pixelpair_identity_version' ) );
		} finally { remove_action( 'add_option_pixelpair_identity_probe', $reject ); }
		$this->assertTrue( Migrations::identity() );
		$this->assertSame( 'keep this copy', get_option( 'pixelpair_identity_probe' ) );
	}

	public function test_read_only_cookie_fallback_and_destination_precedence(): void {
		$_COOKIE = array( 'tagpilot_visitor' => str_repeat( 'a', 32 ), 'tagpilot_commerce_consent' => '{"marketing":{"granted":false,"source":"integration"}}' );
		$before = $_COOKIE;
		$this->assertSame( str_repeat( 'a', 32 ), Migrations::cookie( 'pixelpair_visitor' ) );
		$this->assertFalse( \PixelPair\Commerce\Consent::current()['marketing'] );
		$this->assertSame( $before, $_COOKIE, 'Reading an unresolved/denied consent must not write cookies.' );
		$_COOKIE['pixelpair_visitor'] = str_repeat( 'b', 32 ); Migrations::cookies();
		$this->assertSame( str_repeat( 'b', 32 ), $_COOKIE['pixelpair_visitor'] );
	}

	public function test_live_session_preserves_pending_identity_and_custom_destination(): void {
		$session = new class {
			public $values = array( 'tagpilot_pending' => array( array( 'key' => 'retained-cart-id' ) ), 'tagpilot_attribution' => array( 'utm_source' => 'old' ), 'pixelpair_attribution' => array( 'utm_source' => 'new' ) );
			public function get( $key ) { return $this->values[ $key ] ?? false; }
			public function set( $key, $value ) { $this->values[ $key ] = $value; }
		};
		$pending = Migrations::session( $session, 'pixelpair_pending' );
		$this->assertSame( 'retained-cart-id', $pending[0]['key'] );
		$this->assertFalse( $session->get( 'tagpilot_pending' ) );
		$this->assertSame( $pending, Migrations::session( $session, 'pixelpair_pending' ) );
		$this->assertSame( array( 'utm_source' => 'new' ), Migrations::session( $session, 'pixelpair_attribution' ) );
	}

	public function test_queued_ciphertext_and_purchase_claims_survive_table_rename(): void {
		global $wpdb; \PixelPair\Events\Tables::install();
		$uuid = \PixelPair\Commerce\Claims::id( 'migration:purchase:1' );
		$plain = wp_json_encode( array( 'event_id' => $uuid, 'secret' => wp_generate_password( 32, false ) ) );
		$encrypted = self::legacy_encrypt( $plain );
		$wpdb->insert( $wpdb->prefix . 'pixelpair_jobs', array( 'event_key' => hash( 'sha256', $uuid ), 'event_name' => 'Purchase', 'status' => 'pending', 'next_at' => time(), 'payload' => $encrypted, 'created_at' => time() ) );
		$id = $wpdb->insert_id;
		$this->assertSame( $plain, Crypto::decrypt( $encrypted ), 'Pending work remains readable before the background batch.' );
		foreach ( array( 'claims', 'jobs' ) as $suffix ) { $wpdb->query( "ALTER TABLE {$wpdb->prefix}pixelpair_$suffix RENAME TO {$wpdb->prefix}tagpilot_$suffix" ); }
		$this->assertTrue( Migrations::identity() );
		Migrations::batch(); Migrations::batch();
		$this->assertSame( $uuid, \PixelPair\Commerce\Claims::id( 'migration:purchase:1' ) );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT payload,status FROM {$wpdb->prefix}pixelpair_jobs WHERE id=%d", $id ), ARRAY_A );
		$this->assertSame( 'pending', $row['status'] );
		$this->assertStringStartsWith( 'v2:', $row['payload'] );
		$this->assertSame( $plain, Crypto::decrypt( $row['payload'] ) );
		$wpdb->delete( $wpdb->prefix . 'pixelpair_jobs', array( 'id' => $id ) );
	}

	/** @group commerce */
	public function test_hpos_context_is_readable_before_and_after_batches_and_erasure(): void {
		$this->assertTrue( class_exists( 'WooCommerce' ), 'WooCommerce fixture is required.' );
		$order = wc_create_order();
		$data = array( 'marketing' => true, 'recorded_at' => time(), 'matching' => array( 'external_id' => 'opaque-fixture' ) );
		$order->update_meta_data( '_tagpilot_context', self::legacy_encrypt( wp_json_encode( $data ) ) );
		$order->update_meta_data( '_tagpilot_attribution', array( 'utm_source' => 'fixture' ) ); $order->save();
		try {
			$this->assertSame( $data, \PixelPair\Integrations\WooCommerce\Integration::context( $order ) );
			Migrations::identity(); Migrations::batch(); Migrations::batch();
			$fresh = wc_get_order( $order->get_id() );
			$this->assertSame( $data, \PixelPair\Integrations\WooCommerce\Integration::context( $fresh ) );
			$this->assertFalse( $fresh->meta_exists( '_tagpilot_context' ) );
			$this->assertStringStartsWith( 'v2:', $fresh->get_meta( '_pixelpair_context' ) );
			$fresh->update_meta_data( '_tagpilot_context', self::legacy_encrypt( wp_json_encode( $data ) ) ); $fresh->save();
			Migrations::erase_meta( 'woo', $fresh, '_pixelpair_context' ); $fresh->save();
			$this->assertSame( array(), \PixelPair\Integrations\WooCommerce\Integration::context( $fresh ) );
		} finally { $order->delete( true ); }
	}

	/** @group edd */
	public function test_edd_context_and_attribution_migrate_through_cached_native_reads(): void {
		$this->assertTrue( function_exists( 'edd_add_order' ), 'EDD fixture is required.' );
		$id = edd_add_order( array( 'status' => 'complete', 'type' => 'sale', 'email' => 'migration@example.test', 'payment_key' => md5( wp_generate_uuid4() ), 'currency' => 'USD', 'total' => 1 ) );
		$data = array( 'marketing' => true, 'recorded_at' => time() );
		edd_update_order_meta( $id, '_tagpilot_context', self::legacy_encrypt( wp_json_encode( $data ) ) );
		edd_update_order_meta( $id, '_tagpilot_attribution', array( 'utm_source' => 'fixture' ) );
		try {
			$this->assertSame( $data, \PixelPair\Integrations\EDD\Integration::context( edd_get_order( $id ) ) );
			Migrations::identity(); Migrations::batch(); Migrations::batch();
			$this->assertSame( $data, \PixelPair\Integrations\EDD\Integration::context( edd_get_order( $id ) ) );
			$this->assertSame( '', edd_get_order_meta( $id, '_tagpilot_context', true ) );
			$this->assertSame( array( 'utm_source' => 'fixture' ), edd_get_order_meta( $id, '_pixelpair_attribution', true ) );
			Migrations::erase_meta( 'edd', $id, '_pixelpair_context' );
			$this->assertSame( array(), \PixelPair\Integrations\EDD\Integration::context( edd_get_order( $id ) ) );
		} finally { edd_destroy_order( $id ); }
	}

	public function test_uninstall_removes_both_identities_but_preserves_unrelated_data(): void {
		$post = wp_insert_post( array( 'post_title' => 'Uninstall migration fixture' ) );
		add_option( 'tagpilot_identity_probe', 'old' ); add_option( 'pixelpair_identity_probe', 'new' ); add_option( 'migration_other_plugin', 'keep' );
		add_post_meta( $post, '_tagpilot_probe', 'old' ); add_post_meta( $post, '_pixelpair_probe', 'new' ); add_post_meta( $post, '_other_probe', 'keep' );
		try {
			Migrations::uninstall(); Migrations::uninstall();
			$this->assertFalse( get_option( 'tagpilot_identity_probe' ) ); $this->assertFalse( get_option( 'pixelpair_identity_probe' ) );
			$this->assertSame( '', get_post_meta( $post, '_tagpilot_probe', true ) ); $this->assertSame( '', get_post_meta( $post, '_pixelpair_probe', true ) );
			$this->assertSame( 'keep', get_option( 'migration_other_plugin' ) ); $this->assertSame( 'keep', get_post_meta( $post, '_other_probe', true ) );
		} finally { wp_delete_post( $post, true ); delete_option( 'migration_other_plugin' ); \PixelPair\Events\Tables::install(); }
	}

	public function test_duplicate_metadata_values_survive_across_batch_boundaries(): void {
		$post = wp_insert_post( array( 'post_title' => 'Repeated metadata migration fixture' ) );
		try {
			for ( $i = 0; $i < 105; ++$i ) { add_post_meta( $post, '_tagpilot_repeated', 'value-' . $i ); }
			Migrations::identity(); Migrations::batch();
			$this->assertCount( 5, get_post_meta( $post, '_tagpilot_repeated', false ), 'A batch handles at most 100 rows.' );
			Migrations::batch(); Migrations::batch();
			$this->assertCount( 105, get_post_meta( $post, '_pixelpair_repeated', false ) );
			$this->assertSame( array(), get_post_meta( $post, '_tagpilot_repeated', false ) );
		} finally { wp_delete_post( $post, true ); }
	}

	public function test_reactivation_restores_unfinished_migration_schedule(): void {
		Migrations::identity();
		\PixelPair\Deactivation::clear_jobs();
		$this->assertFalse( wp_next_scheduled( 'pixelpair_legacy_migrate' ) );
		\PixelPair\Activation::activate( false );
		$this->assertNotFalse( wp_next_scheduled( 'pixelpair_legacy_migrate' ) );
	}

	public function test_old_uninstaller_retains_unprocessed_metadata_until_batches_finish(): void {
		add_option( 'tagpilot_settings', array( 'meta_enabled' => true ), '', true );
		$post = wp_insert_post( array( 'post_title' => 'Old uninstaller guard' ) );
		try {
			for ( $i=0; $i<105; ++$i ) { add_post_meta( $post, '_tagpilot_guard_' . $i, 'keep' ); }
			Migrations::identity();
			$this->assertTrue( get_option( 'tagpilot_settings' )['keep_data_on_uninstall'] ?? false );
			Migrations::batch();
			$this->assertTrue( get_option( 'tagpilot_settings' )['keep_data_on_uninstall'] ?? false );
			Migrations::batch(); Migrations::batch();
			$this->assertFalse( get_option( 'tagpilot_settings' ) );
			$this->assertSame( 'keep', get_post_meta( $post, '_pixelpair_guard_104', true ) );
		} finally { wp_delete_post( $post, true ); }
	}

	public function test_concurrent_destination_write_cannot_be_overridden_by_older_context(): void {
		$post = wp_insert_post( array( 'post_title' => 'Consent migration race' ) );
		$grant = self::legacy_encrypt( wp_json_encode( array( 'marketing' => true ) ) );
		$denial = Crypto::encrypt( wp_json_encode( array( 'marketing' => false, 'marketing_revoked' => true ) ) );
		add_post_meta( $post, '_tagpilot_context', $grant );
		$inject = static function ( $value ) use ( $post, $denial ) {
			if ( ! metadata_exists( 'post', $post, '_pixelpair_context' ) ) { add_post_meta( $post, '_pixelpair_context', $denial ); }
			return $value;
		};
		add_filter( 'pre_update_option_pixelpair_legacy_meta_groups', $inject );
		try {
			Migrations::identity(); Migrations::batch(); Migrations::batch();
			$this->assertSame( $denial, get_post_meta( $post, '_pixelpair_context', true ) );
			$this->assertSame( array( $denial ), get_post_meta( $post, '_pixelpair_context', false ) );
		} finally { remove_filter( 'pre_update_option_pixelpair_legacy_meta_groups', $inject ); wp_delete_post( $post, true ); }
	}

	public function test_failed_migration_suppresses_legacy_runtime_callbacks(): void {
		global $wpdb; $old = $wpdb->prefix . 'tagpilot_identity_probe'; $new = $wpdb->prefix . 'pixelpair_identity_probe';
		foreach ( array( $old, $new ) as $table ) { $wpdb->query( "CREATE TABLE $table (id bigint NOT NULL)" ); }
		$legacy_callback = static function () {};
		add_action( 'tagpilot_deliver', $legacy_callback );
		try {
			( new \PixelPair\Plugin() )->register();
			$this->assertFalse( has_action( 'tagpilot_deliver', $legacy_callback ) );
		} finally { remove_action( 'tagpilot_deliver', $legacy_callback ); $wpdb->query( "DROP TABLE IF EXISTS $old" ); $wpdb->query( "DROP TABLE IF EXISTS $new" ); }
	}

	public function test_failed_queue_conversion_is_retried_before_advancing_cursor(): void {
		global $wpdb; \PixelPair\Events\Tables::install();
		$plain = wp_json_encode( array( 'event_id' => wp_generate_uuid4() ) ); $cipher = self::legacy_encrypt( $plain );
		$table = $wpdb->prefix . 'pixelpair_jobs';
		$wpdb->insert( $table, array( 'event_key' => hash( 'sha256', $plain ), 'event_name' => 'PageView', 'status' => 'pending', 'next_at' => time(), 'payload' => $cipher, 'created_at' => time() ) ); $id = $wpdb->insert_id;
		$reject = static function ( $sql ) use ( $table ) { return 0 === strpos( $sql, "UPDATE `$table` SET `payload`" ) ? 'SELECT 0 WHERE 1=0' : $sql; };
		add_filter( 'query', $reject );
		try { Migrations::identity(); Migrations::batch(); }
		finally { remove_filter( 'query', $reject ); }
		try {
			$this->assertSame( $cipher, $wpdb->get_var( $wpdb->prepare( "SELECT payload FROM $table WHERE id=%d", $id ) ) );
			$this->assertLessThan( $id, (int) get_option( 'pixelpair_legacy_queue_cursor', 0 ) );
			Migrations::batch(); $next = $wpdb->get_var( $wpdb->prepare( "SELECT payload FROM $table WHERE id=%d", $id ) );
			$this->assertStringStartsWith( 'v2:', $next ); $this->assertSame( $plain, Crypto::decrypt( $next ) );
		} finally { $wpdb->delete( $table, array( 'id' => $id ) ); }
	}

	/** @group multisite */
	public function test_shared_user_metadata_preserves_duplicates_across_interleaved_sites(): void {
		$this->assertTrue( is_multisite(), 'Multisite fixture required.' );
		$original = get_current_blog_id(); $network = get_network();
		$id = wpmu_create_blog( $network->domain, '/identity-shared-' . wp_generate_password( 8, false ) . '/', 'Shared user migration', 1 );
		try {
			for ( $i = 0; $i < 105; ++$i ) { add_user_meta( 1, '_tagpilot_interleaved', 'value-' . $i ); }
			Migrations::identity(); Migrations::batch();
			$this->assertCount( 5, get_user_meta( 1, '_tagpilot_interleaved', false ) );
			switch_to_blog( $id ); Migrations::batch(); restore_current_blog();
			$this->assertCount( 105, get_user_meta( 1, '_pixelpair_interleaved', false ) );
		} finally {
			while ( get_current_blog_id() !== $original ) { restore_current_blog(); }
			delete_user_meta( 1, '_tagpilot_interleaved' ); delete_user_meta( 1, '_pixelpair_interleaved' );
			require_once ABSPATH . 'wp-admin/includes/ms.php'; wpmu_delete_blog( $id, true );
		}
	}

	/** @group multisite */
	public function test_site_bound_legacy_secrets_remain_isolated_across_network_migration(): void {
		$this->assertTrue( is_multisite(), 'Multisite fixture required.' );
		$original = get_current_blog_id(); $network = get_network(); $sites = array(); $secrets = array(); $encrypted = array();
		try {
			for ( $i = 0; $i < 2; ++$i ) {
				$id = wpmu_create_blog( $network->domain, '/legacy-identity-' . wp_generate_password( 8, false ) . '/', 'Identity fixture', 1 ); $sites[] = $id;
				switch_to_blog( $id ); delete_option( 'pixelpair_secrets' ); delete_option( 'pixelpair_identity_version' );
				$secrets[$id] = wp_generate_password( 32, false ); $encrypted[$id] = self::legacy_encrypt( $secrets[$id] );
				add_option( 'tagpilot_secrets', array( 'token' => $encrypted[$id] ), '', false );
				get_role( 'editor' )->add_cap( 'manage_tagpilot' ); restore_current_blog();
			}
			\PixelPair\Activation::initialize_network( (int) $network->id ); \PixelPair\Activation::initialize_network( (int) $network->id );
			$this->assertSame( $original, get_current_blog_id() );
			foreach ( $sites as $id ) {
				switch_to_blog( $id );
				$this->assertSame( $secrets[$id], ( new \PixelPair\Settings\Secrets() )->token() );
				$this->assertTrue( get_role( 'editor' )->has_cap( 'manage_pixelpair' ) ); $this->assertFalse( get_role( 'editor' )->has_cap( 'manage_tagpilot' ) );
				$this->assertNull( Crypto::decrypt( $encrypted[ $sites[0] === $id ? $sites[1] : $sites[0] ] ) );
				restore_current_blog();
			}
		} finally {
			while ( get_current_blog_id() !== $original ) { restore_current_blog(); }
			require_once ABSPATH . 'wp-admin/includes/ms.php'; foreach ( $sites as $id ) { wpmu_delete_blog( $id, true ); }
		}
	}
}
