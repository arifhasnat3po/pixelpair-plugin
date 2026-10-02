<?php
/**
 * Current configured destination mappings.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events;

/** Revalidate the internal key before creating a platform envelope. */
final class Mapping {
	/**
	 * Service operation.
	 *
	 * @param string $name Internal event key.
	 * @param string $platform Adapter key.
	 * @return array<string,mixed>|null
	 */
	public static function get( string $name, string $platform ): ?array {
		if ( preg_match( '/\A(woo|edd)_/', $name ) ) {
			return \PixelPair\Commerce\Settings::mapping( $name, $platform );
		}
		if ( preg_match( '/\Acustom_([1-9][0-9]*)\z/', $name, $match ) ) {
			$rule = ( new Custom\Repository() )->current( (int) $match[1] );
			return is_array( $rule ) && 'active' === $rule['status'] && ! empty( $rule['platforms'][ $platform ]['enabled'] ) ? $rule['platforms'][ $platform ] : null;
		}
		return Automatic\Registry::mapping( $name, $platform );
	}
	/**
	 * Service operation.
	 *
	 * @param Event  $event Envelope.
	 * @param string $platform Adapter key.
	 * @return array<string,mixed>|null
	 */
	public static function event( Event $event, string $platform ): ?array {
		$mapping = self::get( $event->name, $platform );
		if ( ! $mapping ) {
			return null;
		}
		if ( preg_match( '/\A(woo|edd)_/', $event->name ) ) {
			return array(
				'name'   => $mapping['name'],
				'params' => \PixelPair\Commerce\Payload::map( $event->params, $platform ),
			);
		}
		$params     = $event->params;
		$cart_total = '';
		if ( false !== strpos( (string) wp_json_encode( $mapping['params'] ), '{woo_cart_total}' ) && \PixelPair\Commerce\Settings::get( 'woo' )['enabled'] && function_exists( 'wc_load_cart' ) ) {
			/** REST requests may not initialize the cart service.
			 *
			 * @var \WC_Cart|null $cart
			 */
			$cart = WC()->cart;
			if ( ! $cart ) {
				wc_load_cart(); }
			$cart_total = (string) \PixelPair\Integrations\WooCommerce\Data::cart()['value'];
		}
		$query = array();
		parse_str( (string) wp_parse_url( $event->source_url, PHP_URL_QUERY ), $query );
		foreach ( $mapping['params'] as $key => $value ) {
			$params[ $key ] = is_string( $value ) ? preg_replace_callback(
				'/\{([^{}]+)\}/',
				static function ( array $m ) use ( $event, $query, $cart_total ): string {
					$values = array(
						'post_title'     => $event->params['page_title'] ?? '',
						'post_id'        => $event->params['post_id'] ?? '',
						'post_type'      => $event->params['post_type'] ?? '',
						'page_url'       => $event->source_url,
						'woo_cart_total' => $cart_total,
					);
					$v      = 0 === strpos( $m[1], 'url_param:' ) ? ( $query[ substr( $m[1], 10 ) ] ?? '' ) : ( $values[ $m[1] ] ?? '' );
					return is_scalar( $v ) ? mb_substr( (string) $v, 0, 512 ) : '';
				},
				$value
			) : $value;
		}
		$settings = ( new \PixelPair\Settings\Repository() )->get();
		foreach ( \PixelPair\Settings\Defaults::all()['context_parameters'] as $key ) {
			if ( ! in_array( $key, $settings['context_parameters'], true ) ) {
				unset( $params[ $key ] );
			}
		}
		return array(
			'name'   => $mapping['name'],
			'params' => Params::bound( $params ),
		);
	}
}
