<?php
/**
 * EDD uncached commerce snapshots.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Integrations\EDD;

use PixelPair\Commerce\{Settings, Consent, Delivery};
/**
 * Called only after common origin, schema, consent and exclusion checks.
 */
final class Controller {

	/**
	 * Apply the validated configuration.
	 *
	 * @param array<string,mixed> $d Validated request.
	 * @param array<string,mixed> $context Consent.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function snapshot( array $d, array $context ) {
		$action = $d['action'];
		$key    = 'edd:page:' . $d['event_id'];
		$s      = Settings::get( 'edd' );
		$events = array();
		$data   = array();
		if ( in_array( $action, array( 'view_item', 'view_item_list' ), true ) ) {
			$ids = 'view_item' === $action ? array( $d['product_id'] ?? 0 ) : $d['product_ids'] ?? array();
			if ( ! is_array( $ids ) || count( $ids ) > 200 ) {
				return self::error( 400 );
			}
			$items = array();
			$price = $d['price_id'] ?? null;
			if ( null !== $price && ( ! is_int( $price ) || $price < 0 ) ) {
				return self::error( 400 );
			}
			foreach ( array_slice( $ids, 0, 'view_item' === $action ? 1 : $s['list_limit'] ) as $id ) {
				if ( ! is_int( $id ) ) {
					return self::error( 400 );
				}
				$data = Data::product( $id, 1, $price );
				if ( ! $data ) {
					return self::error( 404 );
				}
				$items = array_merge( $items, $data['items'] );
			}
			$data['items'] = $items;
			if ( 'view_item_list' === $action ) {
				$d['targets'] = array_intersect( $d['targets'], array( 'ga4' ) );
				unset( $data['value'] );
			}
		} elseif ( 'purchase' === $action ) {
			parse_str( (string) wp_parse_url( $d['url'], PHP_URL_QUERY ), $query );
			$order = Data::receipt( $query );
			if ( ! $order ) {
				return self::error( 403 );
			}
			$key     = 'edd:purchase:' . $order->id;
			$data    = Data::order( $order );
			$context = Consent::receipt( 'edd', $order, $context );
		} elseif ( in_array( $action, array( 'pending', 'view_cart', 'begin_checkout', 'add_payment_info', 'context' ), true ) ) {
			if ( ! EDD()->session ) {
				return self::error( 503 );
			}
			if ( $s['attribution'] && isset( $d['attribution'] ) && is_array( $d['attribution'] ) && ! \PixelPair\Settings\Migrations::session( EDD()->session, 'pixelpair_attribution' ) ) {
				EDD()->session->set( 'pixelpair_attribution', Consent::attribution( $d['attribution'], $context['marketing'] ) );
			}
			if ( 'pending' === $action ) {
				$pending = array_filter(
					(array) \PixelPair\Settings\Migrations::session( EDD()->session, 'pixelpair_pending' ),
					static function ( $row ) {
						return is_array( $row ) && ( $row['expires'] ?? 0 ) > time();
					}
				);
				EDD()->session->set( 'pixelpair_pending', array_values( $pending ) );
				foreach ( $pending as $row ) {
					$events[] = Delivery::browser( $row['key'], 'edd_add_to_cart', $row['snapshot'], $context, $d['targets'], true );
				}
				return array( 'events' => $events );
			}
			$data = Data::cart();
			if ( 'context' === $action ) {
				return array(
					'events'     => array(),
					'cart_total' => $data['value'],
				);
			}
			if ( 'add_payment_info' === $action ) {
				$method = $d['payment_method'] ?? '';
				if ( ! is_string( $method ) || ! isset( edd_get_enabled_payment_gateways()[ $method ] ) ) {
					return self::error( 400 );
				}
				$data['payment_type'] = $method;
			}
		} else {
			return self::error( 400 );
		}
		if ( ! empty( $data['items'] ) ) {
			$events[] = Delivery::browser( $key, 'edd_' . $action, $data, $context, $d['targets'], true );
		}
		return array(
			'events'     => $events,
			'cart_total' => $data['value'] ?? 0,
		);
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @return array<string,mixed> Public catalog-only page information.
	 */
	public static function configuration(): array {
		$page = '';
		$id   = 0;
		$ids  = array();
		if ( edd_is_success_page() || is_page( (int) edd_get_option( 'success_page', 0 ) ) ) {
			$page = 'purchase';
		} elseif ( edd_is_checkout() ) {
			$page = 'begin_checkout';
		} elseif ( is_singular( 'download' ) ) {
			$page = 'view_item';
			$id   = get_queried_object_id();
		} elseif ( is_post_type_archive( 'download' ) || is_tax( array( 'download_category', 'download_tag' ) ) ) {
			$page = 'view_item_list';
			global $wp_query;
			foreach ( (array) $wp_query->posts as $post ) {
				if ( $post instanceof \WP_Post ) {
					$ids[] = $post->ID;
				}
			}
		}
		return array(
			'enabled'     => true,
			'page'        => $page,
			'product_id'  => $id,
			'product_ids' => array_slice( $ids, 0, Settings::get( 'edd' )['list_limit'] ),
		);
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param int $status HTTP status.
	 * @return \WP_Error
	 */
	private static function error( int $status ): \WP_Error {
		return new \WP_Error( 'pixelpair_commerce_rejected', __( 'Commerce tracking is unavailable for this request.', 'pixelpair' ), array( 'status' => $status ) );
	}
}
