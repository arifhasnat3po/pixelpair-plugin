<?php
/**
 * WordPress privacy tools for plugin-owned order attribution.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Privacy;

/** Use store CRUD APIs, including WooCommerce HPOS. */
final class Integration {

	/** Register privacy hooks and the EDD attribution view. */
	public function register(): void {
		add_action( 'admin_init', array( $this, 'policy' ) );
		add_filter(
			'wp_privacy_personal_data_exporters',
			function ( $items ) {
				$items['pixelpair'] = array(
					'exporter_friendly_name' => __( 'PixelPair order attribution', 'pixelpair' ),
					'callback'               => array( $this, 'export' ),
				);
				return $items;
			}
		);
		add_filter(
			'wp_privacy_personal_data_erasers',
			function ( $items ) {
				$items['pixelpair'] = array(
					'eraser_friendly_name' => __( 'PixelPair order attribution', 'pixelpair' ),
					'callback'             => array( $this, 'erase' ),
				);
				return $items;
			}
		);
		add_action( 'edd_view_order_details_main_after', array( $this, 'edd_box' ) );
	}
	/** Provide text for the owner to adapt to the site's actual configuration. */
	public function policy(): void {
		if ( function_exists( 'wp_add_privacy_policy_content' ) ) {
			wp_add_privacy_policy_content( 'PixelPair', wp_kses_post( __( '<p>When enabled by this site, PixelPair sends browsing and purchase events to Meta, TikTok, Google Analytics or Google Tag Manager according to the configured consent categories. Events may contain page details, product identifiers, totals, IP address, user agent and advertising cookie/click identifiers. Optional advanced matching sends normalized SHA-256 hashes of permitted contact identifiers. These hashes remain personal data.</p><p>PixelPair may store campaign attribution on orders and an encrypted matching/consent snapshot for up to 30 days of eligible dispatch. Delivery jobs are encrypted and are cleared on completion or purged after seven days; redacted logs follow the owner-selected 1–90 day retention. Order attribution persists until erased with WordPress privacy tools or removed by the owner. Explain your enabled destinations, legal basis, retention, international transfers and how visitors can change consent.</p>', 'pixelpair' ) ) );
		}
	}
	/**
	 * Read a stable email-scoped page from each installed store.
	 *
	 * @param string $email Verified privacy-request email.
	 * @param int    $page Page number.
	 * @return array<string,array<mixed>>
	 */
	private function orders( string $email, int $page ): array {
		if ( ! is_email( $email ) ) {
			return array(
				'woo' => array(),
				'edd' => array(),
			);
		}
		$offset = ( max( 1, $page ) - 1 ) * 50;
		return array(
			'woo' => function_exists( 'wc_get_orders' ) ? wc_get_orders(
				array(
					'billing_email' => $email,
					'limit'         => 50,
					'offset'        => $offset,
					'orderby'       => 'ID',
					'order'         => 'ASC',
				)
			) : array(),
			'edd' => function_exists( 'edd_get_orders' ) ? edd_get_orders(
				array(
					'email'   => $email,
					'number'  => 50,
					'offset'  => $offset,
					'orderby' => 'id',
					'order'   => 'ASC',
				)
			) : array(),
		);
	}
	/**
	 * Export attribution only, never encrypted matching or credentials.
	 *
	 * @param string $email Verified request email.
	 * @param int    $page Page number.
	 * @return array<string,mixed>
	 */
	public function export( string $email, int $page = 1 ): array {
		$groups = $this->orders( $email, $page );
		$data   = array();
		foreach ( $groups as $provider => $orders ) {
			foreach ( $orders as $order ) {
				$id     = 'woo' === $provider ? $order->get_id() : $order->id;
				$values = \PixelPair\Settings\Migrations::meta( $provider, 'woo' === $provider ? $order : $id, '_pixelpair_attribution' );
				if ( ! is_array( $values ) || ! $values ) {
					continue;
				}
				$fields = array();
				foreach ( \PixelPair\Commerce\Consent::attribution( $values, true ) as $key => $value ) {
					$fields[] = array(
						'name'  => $key,
						'value' => $value,
					);
				}
				$data[] = array(
					'group_id'    => 'pixelpair',
					'group_label' => __( 'PixelPair attribution', 'pixelpair' ),
					'item_id'     => 'pixelpair-' . $provider . '-' . $id,
					'data'        => $fields,
				);
			}
		}
		return array(
			'data' => $data,
			'done' => count( $groups['woo'] ) < 50 && count( $groups['edd'] ) < 50,
		);
	}
	/**
	 * Erase only PixelPair metadata, retaining order and payment records.
	 *
	 * @param string $email Verified request email.
	 * @param int    $page Page number.
	 * @return array<string,mixed>
	 */
	public function erase( string $email, int $page = 1 ): array {
		$groups  = $this->orders( $email, $page );
		$removed = false;
		foreach ( $groups as $provider => $orders ) {
			foreach ( $orders as $order ) {
				foreach ( array( '_pixelpair_attribution', '_pixelpair_context' ) as $key ) {
					$object  = 'woo' === $provider ? $order : $order->id;
					$removed = (bool) \PixelPair\Settings\Migrations::meta( $provider, $object, $key ) || $removed;
					\PixelPair\Settings\Migrations::erase_meta( $provider, $object, $key );
				}
				\PixelPair\Events\Queue::erase_subject( $provider . ':purchase:' . ( 'woo' === $provider ? $order->get_id() : $order->id ) );
				if ( 'woo' === $provider ) {
					$order->save();
				}
			}
		}
		return array(
			'items_removed'  => $removed,
			'items_retained' => false,
			'messages'       => array(),
			'done'           => count( $groups['woo'] ) < 50 && count( $groups['edd'] ) < 50,
		);
	}
	/**
	 * Show bounded EDD attribution to authorized order managers.
	 *
	 * @param int $id Native order ID.
	 */
	public function edd_box( $id ): void {
		if ( ! current_user_can( 'manage_pixelpair' ) || ! current_user_can( 'edit_shop_payments' ) || \PixelPair\Commerce\Settings::get( 'edd' )['hide_attribution'] ) {
			return;
		}
		$values = \PixelPair\Settings\Migrations::meta( 'edd', $id, '_pixelpair_attribution' );
		if ( ! is_array( $values ) || ! $values ) {
			return;
		}
		echo '<h3>' . esc_html__( 'PixelPair attribution', 'pixelpair' ) . '</h3><dl>';
		foreach ( \PixelPair\Commerce\Consent::attribution( $values, true ) as $key => $value ) {
			echo '<dt>' . esc_html( $key ) . '</dt><dd>' . esc_html( $value ) . '</dd>';
		}
		echo '</dl>';
	}
}
