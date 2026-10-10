<?php
/**
 * Service composition and WordPress hook registration.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair;

use PixelPair\Admin\Assets;
use PixelPair\Admin\Menu;

/** Compose the plugin services. */
final class Plugin {
	/** Register the plugin services. */
	public function register(): void {
		add_action( 'pixelpair_legacy_migrate', array( Settings\Migrations::class, 'batch' ) );
		Settings\Migrations::retire_plugin();
		if ( ! Settings\Migrations::identity() ) {
			add_action( 'admin_notices', array( Settings\Migrations::class, 'notice' ) );
			return;
		}
		( new AI\Abilities() )->register();
		add_action( 'wp_ajax_pixelpair_debug', array( new Admin\Debug(), 'handle' ) );
		( new Privacy\Integration() )->register();
		add_action( 'rest_api_init', array( new Admin\DashboardController(), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Admin\TransferController(), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Admin\PermissionsController(), 'register_routes' ) );
		( new Integrations\WooCommerce\Integration() )->register();
		( new Integrations\EDD\Integration() )->register();
		add_action( 'rest_api_init', array( new Commerce\Controller(), 'register_routes' ) );
		( new Events\Automatic\Flags() )->register();
		add_action( 'rest_api_init', array( new Events\Custom\Controller(), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Events\ContextController(), 'register_routes' ) );
		add_filter( 'wp_consent_api_registered_' . plugin_basename( PIXELPAIR_FILE ), '__return_true' );
		add_action( 'rest_api_init', array( new Admin\GtmController(), 'register_routes' ) );
		add_action( 'admin_init', array( Settings\Migrations::class, 'run' ) );
		add_action( 'rest_api_init', array( new Admin\SettingsController(), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Admin\MetaController(), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Admin\TikTokController(), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Logs\Controller(), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Events\CollectorController(), 'register_routes' ) );
		add_action( 'pixelpair_deliver', array( new Events\Queue(), 'run' ) );
		add_action( 'pixelpair_queue_sweep', array( new Events\Queue(), 'sweep' ) );
		add_action( 'pixelpair_log_purge', array( new Logs\Repository(), 'purge' ) );
		add_action( 'pixelpair_log_purge', array( Commerce\Claims::class, 'purge' ) );
		( new Events\BootstrapController() )->register();
		$notice = new Admin\ConsentNotice();
		add_action( 'admin_notices', array( $notice, 'render' ) );
		add_action( 'admin_post_pixelpair_dismiss_consent', array( $notice, 'handle' ) );
		add_action( 'wp_enqueue_scripts', array( new Events\EventManager(), 'render_config' ), 20 );
		add_action( 'login_enqueue_scripts', array( new Events\EventManager(), 'render_action_consent' ), 20 );
		add_action( 'admin_menu', array( new Menu(), 'register' ) );
		add_filter( 'admin_footer_text', array( new Menu(), 'footer' ) );
		add_action( 'admin_enqueue_scripts', array( new Assets(), 'enqueue' ) );
		add_action( 'wp_initialize_site', array( Activation::class, 'on_created_site' ), 200 );
		add_action( 'pixelpair_initialize_network', array( Activation::class, 'initialize_network' ), 10, 2 );
	}
}
