<?php
/**
 * Inert script slots with browser consent and device targeting.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Scripts;

/**
 * Render markup only through the gated client; never raw executable code in caches.
 */
final class Renderer {

	/**
	 * Register frontend slots.
	 */
	public function register(): void {
		add_action(
			'wp_head',
			function (): void {
				$this->render( 'head' );
			},
			99
		);
		add_action(
			'wp_body_open',
			function (): void {
				$this->render( 'body' );
			}
		);
		add_action(
			'wp_footer',
			function (): void {
				$this->render( 'footer' );
			},
			5
		);
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param int    $post_id Current public post.
	 * @param string $slot Location.
	 * @return list<array<string,string>>
	 */
	public static function rows( int $post_id, string $slot ): array {
		$global = ( new Repository() )->get();
		$meta   = $post_id ? \PixelPair\Settings\Migrations::meta( 'post', $post_id, '_pixelpair_scripts' ) : array();
		$mode   = is_array( $meta ) ? $meta['mode'] ?? 'inherit' : 'inherit';
		if ( 'disable' === $mode ) {
			return array();
		}
		$rows = 'replace' === $mode ? array() : array( $global[ $slot ] );
		if ( in_array( $mode, array( 'append', 'replace' ), true ) && Repository::valid( $meta['scripts'] ?? null ) ) {
			$rows[] = $meta['scripts'][ $slot ];
		}
		return array_values(
			array_filter(
				$rows,
				static function ( array $row ): bool {
					return '' !== trim( $row['code'] );
				}
			)
		);
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param string $slot Hook location.
	 */
	public function render( string $slot ): void {
		$settings = ( new \PixelPair\Settings\Repository() )->get();
		$source   = home_url() . '/' . ltrim( \PixelPair\Support\Request::server( 'REQUEST_URI' ), '/' );
		if ( ( new \PixelPair\Exclusions\ContextDetector() )->is_excluded() || ( new \PixelPair\Exclusions\ContextDetector() )->excluded_url( $source ) || ( ! $settings['strict_cache_mode'] && ! ( new \PixelPair\Exclusions\ExclusionManager() )->should_track( $source, true ) ) ) {
			return;
		}
		$rows = self::rows( is_singular() ? get_queried_object_id() : 0, $slot );
		if ( 'footer' === $slot && function_exists( 'is_order_received_page' ) && is_order_received_page() ) {
			$row = ( new Repository() )->get()['receipt'];
			if ( '' !== $row['code'] && self::page_allows_receipt() ) {
				$row['code']    = '';
				$row['receipt'] = rest_url( 'pixelpair/v1/script-receipt' );
				$rows[]         = $row;
			}
		}
		if ( ! $rows || ! is_readable( PIXELPAIR_PATH . 'build/scripts.js' ) ) {
			return;
		}
		wp_enqueue_script( 'pixelpair-scripts', plugins_url( 'build/scripts.js', PIXELPAIR_FILE ), array(), PIXELPAIR_VERSION, true );
		$data                       = array(
			'rows'    => $rows,
			'consent' => ( new \PixelPair\Integrations\Consent\ConsentManager() )->config(),
			'gate'    => array(
				'required' => $settings['strict_cache_mode'] || ! empty( $settings['excluded_ips'] ),
				'url'      => admin_url( 'admin-ajax.php?action=pixelpair_bootstrap', 'relative' ),
			),
		);
		$data['consent']['blocked'] = ! $settings['strict_cache_mode'] && false === ( new \PixelPair\Integrations\Consent\ConsentManager() )->override();
        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Inert JSON with HTML metacharacters encoded; execution is consent gated in scripts.js.
		echo '<script type="application/json" class="pixelpair-script-slot">' . wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . '</script>';
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @return bool Per-page disable also disables the receipt slot.
	 */
	private static function page_allows_receipt(): bool {
		$meta = \PixelPair\Settings\Migrations::meta( 'post', get_queried_object_id(), '_pixelpair_scripts' );
		return ! is_array( $meta ) || 'disable' !== ( $meta['mode'] ?? '' );
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param string              $code Authorized template.
	 * @param array<string,mixed> $values Verified order fields.
	 * @return string Safe JSON literals.
	 */
	public static function substitute( string $code, array $values ): string {
		foreach ( array( 'order_id', 'order_total', 'currency' ) as $key ) {
			$code = str_replace( '{' . $key . '}', (string) wp_json_encode( $values[ $key ] ?? null, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ), $code );
		}
		return $code;
	}
}
