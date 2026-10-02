<?php
/**
 * EDD lifecycle integration.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Integrations\EDD;

use PixelPair\Commerce\{Settings, Consent, Delivery};
use PixelPair\Support\Crypto;
/**
 * Capture only confirmed cart actions and consented checkout context.
 */
final class Integration {

	/** Register confirmed store lifecycle hooks. */
	public function register(): void {
		add_action( 'edd_post_add_to_cart', array( $this, 'added' ), 10, 3 );
		add_action( 'edd_built_order', array( $this, 'capture_order' ) );
		add_action( 'edd_complete_purchase', array( $this, 'schedule_purchase' ) );
		add_action( 'pixelpair_edd_purchase', array( $this, 'purchase' ) );
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param int                            $id Download.
	 * @param array<string,mixed>            $options Options.
	 * @param array<int,array<string,mixed>> $items Confirmed items.
	 */
	public function added( $id, $options, $items ): void {
		$s = Settings::get( 'edd' );
		if ( ! $s['enabled'] || ! EDD()->session ) {
			return;
		}
		$context = Consent::current();
		if ( ! $context['marketing'] && ! $context['statistics'] ) {
			return;
		}
		foreach ( $items as $row ) {
			$p        = $row['options']['price_id'] ?? null;
			$snapshot = Data::product( (int) $row['id'], (int) $row['quantity'], null === $p ? null : (int) $p );
			if ( ! $snapshot ) {
				continue;
			}
			$key = 'edd:cart:' . wp_generate_uuid4();
			if ( 'hook' === $s['add_to_cart_source'] ) {
				Delivery::enqueue( $key, 'edd_add_to_cart', $snapshot, $context );
			}
			$pending   = (array) \PixelPair\Settings\Migrations::session( EDD()->session, 'pixelpair_pending' );
			$pending[] = array(
				'key'      => $key,
				'snapshot' => $snapshot,
				'expires'  => time() + 600,
			);
			EDD()->session->set( 'pixelpair_pending', array_slice( $pending, -20 ) );
		}
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param int $id Newly built checkout order.
	 */
	public function capture_order( $id ): void {
		if ( ! Settings::get( 'edd' )['enabled'] ) {
			return;
		}
		$order = edd_get_order( $id );
		if ( ! $order ) {
			return;
		}
		$context = Consent::current();
		if ( ! $context['marketing'] && ! $context['statistics'] ) {
			return;
		}
		$s = ( new \PixelPair\Settings\Repository() )->get();
		foreach ( array(
			'meta'   => 'matching',
			'tiktok' => 'tiktok_matching',
		) as $platform => $key ) {
			if ( $context['marketing'] && $s[ $platform . '_advanced_matching' ] ) {
				$context[ $key ] = array_replace( (array) ( $context[ $key ] ?? array() ), \PixelPair\UserData\Normalizer::hashes( array( 'em' => $order->email ) ) );
			}
		}
		try {
			edd_update_order_meta( $id, '_pixelpair_context', Crypto::encrypt( (string) wp_json_encode( $context ) ) );
		} catch ( \Throwable $error ) {
			return;
		}
		if ( Settings::get( 'edd' )['attribution'] ) {
			edd_update_order_meta( $id, '_pixelpair_attribution', Consent::attribution( (array) \PixelPair\Settings\Migrations::session( EDD()->session, 'pixelpair_attribution' ), $context['marketing'] ) );
		}
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param int $id Completed order.
	 */
	public function schedule_purchase( $id ): void {
		if ( Settings::get( 'edd' )['safety_net'] && ! wp_next_scheduled( 'pixelpair_edd_purchase', array( (int) $id ) ) ) {
			wp_schedule_single_event( time() + 60, 'pixelpair_edd_purchase', array( (int) $id ) );
		}
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param int $id Completed order.
	 */
	public function purchase( $id ): void {
		if ( ! function_exists( 'edd_get_order' ) || ! Settings::get( 'edd' )['enabled'] ) {
			return;
		}
		$order = edd_get_order( $id );
		if ( $order && self::paid( $order ) ) {
			Delivery::enqueue( 'edd:purchase:' . $id, 'edd_purchase', Data::order( $order ), self::context( $order ) );
		}
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param \EDD\Orders\Order $order Order.
	 * @return bool
	 */
	public static function paid( $order ): bool {
		$renewal = (int) $order->parent > 0 || 'edd_subscription' === $order->status;
		return 'sale' === $order->type && ( ! $renewal || Settings::get( 'edd' )['renewals'] ) && in_array( $order->status, array( 'complete', 'completed', 'publish', 'edd_subscription' ), true );
	}
	/**
	 * Apply the validated configuration.
	 *
	 * @param \EDD\Orders\Order $order Order.
	 * @return array<string,mixed>
	 */
	public static function context( $order ): array {
		$raw   = \PixelPair\Settings\Migrations::meta( 'edd', $order->id, '_pixelpair_context' );
		$plain = is_string( $raw ) ? Crypto::decrypt( $raw ) : null;
		$data  = $plain ? json_decode( $plain, true ) : null;
		return is_array( $data ) ? $data : array();
	}
}
