<?php
/**
 * Uncached, authoritative commerce snapshots.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Commerce;

use PixelPair\Support\{Request, RateLimiter};
use PixelPair\Events\BootstrapController;
use PixelPair\Integrations\WooCommerce\{Data, Integration};
/**
 * Public collection requires same-origin requests, consent and receipt/session authority.
 */
final class Controller {

	/**
	 * Register the consented public collector, not an administrative mutation.
	 */
	public function register_routes(): void {
		register_rest_route(
			'pixelpair/v1',
			'/commerce',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => array( $this, 'handle' ),
			)
		);
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response Response.
	 */
	public function handle( \WP_REST_Request $request ): \WP_REST_Response {
		$previous = get_current_user_id();
		wp_set_current_user( (int) wp_validate_auth_cookie( '', 'logged_in' ) );
		try {
			$origin = (string) $request->get_header( 'origin' );
			$r      = $this->evaluate( $request->get_body(), $origin ? $origin : (string) $request->get_header( 'referer' ) );
		} catch ( \Throwable $error ) {
			$r = $this->error( 503 );
		} finally {
			wp_set_current_user( $previous );
		}
		return new \WP_REST_Response( is_wp_error( $r ) ? array( 'code' => $r->get_error_code() ) : $r, is_wp_error( $r ) ? $r->get_error_data()['status'] : 200, BootstrapController::headers() );
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param string $body JSON.
	 * @param string $origin Origin.
	 * @return array<string,mixed>|\WP_Error Result.
	 */
	public function evaluate( string $body, string $origin ) {
		if ( ! Request::same_origin( $origin, home_url() ) ) {
			return $this->error( 403 );
		}
		if ( strlen( $body ) > 8192 ) {
			return $this->error( 413 );
		}
		$d = json_decode( $body, true );
		if ( ! is_array( $d ) || array_diff( array_keys( $d ), array( 'provider', 'action', 'url', 'event_id', 'targets', 'consent', 'product_id', 'product_ids', 'attribution', 'payment_method', 'price_id' ) ) || ! isset( $d['provider'], $d['action'], $d['url'], $d['event_id'], $d['targets'], $d['consent'] ) || ! is_string( $d['provider'] ) || ! in_array( $d['provider'], array( 'woo', 'edd' ), true ) || ! is_string( $d['action'] ) || ! is_string( $d['url'] ) || strlen( $d['url'] ) > 4096 || ! Request::same_origin( $d['url'], home_url() ) || ! is_string( $d['event_id'] ) || ! preg_match( '/\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i', $d['event_id'] ) || ! is_array( $d['targets'] ) || count( $d['targets'] ) > 4 || array_filter(
			$d['targets'],
			static function ( $v ) {
				return ! is_string( $v ) || ! in_array( $v, array( 'meta', 'ga4', 'gtm', 'tiktok' ), true );
			}
		) || ! is_array( $d['consent'] ) || array_diff( array_keys( $d['consent'] ), array( 'marketing', 'statistics' ) ) ) {
			return $this->error( 400 );
		}
		if ( ! RateLimiter::allow( Request::client_ip(), 'commerce' ) ) {
			return $this->error( 429 );
		}
		if ( ! ( new \PixelPair\Exclusions\ExclusionManager() )->should_track( $d['url'] ) ) {
			return $this->error( 403 );
		}
		$context = Consent::current( $d['consent'] );
		if ( ! $context['marketing'] && ! $context['statistics'] && 'purchase' !== $d['action'] ) {
			return $this->error( 403 );
		}
		if ( 'edd' === $d['provider'] && function_exists( 'edd_get_order' ) && Settings::get( 'edd' )['enabled'] ) {
			return ( new \PixelPair\Integrations\EDD\Controller() )->snapshot( $d, $context );
		}
		if ( 'woo' !== $d['provider'] || ! function_exists( 'WC' ) || ! Settings::get( 'woo' )['enabled'] ) {
			return $this->error( 404 );
		}
		return $this->woo( $d, $context );
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param array<string,mixed> $d Validated request.
	 * @param array<string,mixed> $context Consent.
	 * @return array<string,mixed>|\WP_Error Snapshots.
	 */
	private function woo( array $d, array $context ) {
		$action   = $d['action'];
		$settings = Settings::get( 'woo' );
		$events   = array();
		$key      = 'woo:page:' . $d['event_id'];
		$snapshot = array();
		if ( in_array( $action, array( 'view_item', 'view_item_list' ), true ) ) {
			$ids = 'view_item' === $action ? array( $d['product_id'] ?? 0 ) : $d['product_ids'] ?? array();
			if ( ! is_array( $ids ) || count( $ids ) > 200 ) {
				return $this->error( 400 );
			}
			$ids   = array_slice( $ids, 0, 'view_item' === $action ? 1 : $settings['list_limit'] );
			$items = array();
			foreach ( $ids as $id ) {
				if ( ! is_int( $id ) || $id < 1 ) {
					return $this->error( 400 );
				}
				$p = wc_get_product( $id );
				if ( ! $p || 'publish' !== $p->get_status() || ( $p->get_parent_id() && 'publish' !== get_post_status( $p->get_parent_id() ) ) ) {
					return $this->error( 404 );
				}
				$data     = Data::product( $p, 1 );
				$items    = array_merge( $items, $data['items'] );
				$snapshot = $data;
			}
			$snapshot['items'] = $items;
			if ( 'view_item_list' === $action ) {
				$d['targets'] = array_intersect( $d['targets'], array( 'ga4' ) );
				unset( $snapshot['value'] );
			}
		} elseif ( 'purchase' === $action ) {
			parse_str( (string) wp_parse_url( $d['url'], PHP_URL_QUERY ), $query );
			$receipt = $query['key'] ?? '';
			$order   = is_string( $receipt ) && strlen( $receipt ) < 128 ? Data::receipt( $receipt ) : null;
			if ( ! $order || ! ( new Integration() )->renewal_allowed( $order ) ) {
				return $this->error( 403 );
			}
			$key      = 'woo:purchase:' . $order->get_id();
			$snapshot = Data::order( $order );
			$context  = Consent::receipt( 'woo', $order, $context );
		} else {
			if ( ! in_array( $action, array( 'pending', 'view_cart', 'begin_checkout', 'add_payment_info', 'add_shipping_info', 'context' ), true ) ) {
				return $this->error( 400 );
			}
			/**
 * WooCommerce initializes this service only for relevant requests.
			 *
 * @var \WC_Cart|null $cart WooCommerce does not initialize carts on every REST request.
 */
			$cart = WC()->cart;
			if ( ! $cart ) {
				wc_load_cart();
			}
			/**
 * WooCommerce initializes this service only for relevant requests.
			 *
 * @var \WC_Session|null $session Optional session service.
 */
			$session = WC()->session;
			if ( ! $session ) {
				return $this->error( 503 );
			}
			// A late empty snapshot must never replace the cookie from a concurrent cart addition.
			$has_session = method_exists( $session, 'has_session' ) && $session->has_session();
			if ( in_array( $action, array( 'pending', 'context' ), true ) && ! $has_session ) {
				return array(
					'events'     => array(),
					'cart_total' => 0,
				);
			}
			if ( $has_session && isset( $d['attribution'] ) && is_array( $d['attribution'] ) && $settings['attribution'] && ! \PixelPair\Settings\Migrations::session( $session, 'pixelpair_attribution' ) ) {
				$session->set( 'pixelpair_attribution', Consent::attribution( $d['attribution'], $context['marketing'] ) );
			}
			if ( 'pending' === $action ) {
				$pending = array_filter(
					(array) \PixelPair\Settings\Migrations::session( WC()->session, 'pixelpair_pending', array() ),
					static function ( $row ) {
						return is_array( $row ) && ( $row['expires'] ?? 0 ) > time();
					}
				);
				WC()->session->set( 'pixelpair_pending', array_values( $pending ) );
				foreach ( $pending as $row ) {
					$events[] = Delivery::browser( $row['key'], 'woo_add_to_cart', $row['snapshot'], $context, $d['targets'], true );
				}
				return array( 'events' => $events );
			}
			$snapshot = Data::cart();
			if ( 'context' === $action ) {
				return array(
					'events'     => array(),
					'cart_total' => $snapshot['value'],
				);
			}
			if ( 'add_payment_info' === $action ) {
				$method = $d['payment_method'] ?? (string) $session->get( 'chosen_payment_method', '' );
				if ( ! is_string( $method ) || ! isset( WC()->payment_gateways()->get_available_payment_gateways()[ $method ] ) ) {
					return $this->error( 400 ); }
				$snapshot['payment_type'] = $method;
			}
			if ( 'add_shipping_info' === $action ) {
				$snapshot['shipping_tier'] = implode( ',', array_map( 'sanitize_text_field', (array) WC()->session->get( 'chosen_shipping_methods', array() ) ) );
			}
		}
		if ( ! empty( $snapshot['items'] ) ) {
			$events[] = Delivery::browser( $key, 'woo_' . $action, $snapshot, $context, $d['targets'], true );
		}
		return array(
			'events'     => $events,
			'cart_total' => $snapshot['value'] ?? 0,
		);
	}
	/**
	 * Cacheable configuration contains public catalog IDs only.
	 *
	 * @return array<string,mixed> Config.
	 */
	public static function configuration(): array {
		$out = array( 'url' => rest_url( 'pixelpair/v1/commerce' ) );
		if ( function_exists( 'edd_get_order' ) && Settings::get( 'edd' )['enabled'] ) {
			$out['edd'] = \PixelPair\Integrations\EDD\Controller::configuration();
		}
		if ( function_exists( 'WC' ) && Settings::get( 'woo' )['enabled'] ) {
			$page = '';
			$id   = 0;
			$ids  = array();
			if ( is_product() ) {
				$page = 'view_item';
				$id   = get_queried_object_id();
			} elseif ( is_order_received_page() ) {
				$page = 'purchase';
			} elseif ( is_checkout() ) {
				$page = 'begin_checkout';
			} elseif ( is_cart() ) {
				$page = 'view_cart';
			} elseif ( is_shop() || is_product_taxonomy() ) {
				$page = 'view_item_list';
				global $wp_query;
				foreach ( (array) $wp_query->posts as $post ) {
					if ( $post instanceof \WP_Post ) {
						$ids[] = $post->ID;
					}
				}
			}
			$out['woo'] = array(
				'enabled'            => true,
				'page'               => $page,
				'product_id'         => $id,
				'product_ids'        => array_slice( $ids, 0, Settings::get( 'woo' )['list_limit'] ),
				'add_to_cart_source' => Settings::get( 'woo' )['add_to_cart_source'],
			);
		}
		return $out;
	}
	/**
	 * Provide validated commerce data.
	 *
	 * @param int $status HTTP status.
	 * @return \WP_Error Error.
	 */
	private function error( int $status ): \WP_Error {
		return new \WP_Error( 'pixelpair_commerce_rejected', __( 'Commerce tracking is unavailable for this request.', 'pixelpair' ), array( 'status' => $status ) );
	}
}
