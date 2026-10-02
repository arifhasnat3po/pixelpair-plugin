<?php
/**
 * Bounded declarative event rules.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Custom;

use PixelPair\Settings\EventSchema;
/** Reject executable code, unbounded regular expressions and malformed selectors. */
final class Validator {
	/**
	 * Service operation.
	 *
	 * @param array<string,mixed> $data Submitted rule.
	 * @return array<string,mixed>|\WP_Error
	 */
	public static function validate( array $data ) {
		if ( array_diff( array_keys( $data ), array( 'id', 'name', 'status', 'triggers', 'conditions', 'platforms', 'once_per_session', 'created_at', 'updated_at' ) ) || ! is_string( $data['name'] ?? null ) || '' === trim( $data['name'] ) || strlen( $data['name'] ) > 120 || ! in_array( $data['status'] ?? null, array( 'active', 'paused' ), true ) || ! is_bool( $data['once_per_session'] ?? null ) || ! EventSchema::platforms( $data['platforms'] ?? null ) ) {
			return self::error();
		}
		foreach ( array( 'triggers', 'conditions' ) as $key ) {
			if ( ! isset( $data[ $key ] ) || ! is_array( $data[ $key ] ) || array_values( $data[ $key ] ) !== $data[ $key ] || count( $data[ $key ] ) > 20 || ( 'triggers' === $key && ! $data[ $key ] ) ) {
				return self::error();
			}
			foreach ( $data[ $key ] as $value ) {
				if ( ! is_array( $value ) || ! ( 'triggers' === $key ? self::trigger( $value ) : self::condition( $value ) ) ) {
					return self::error();
				}
			}
		}
		if ( '' === sanitize_text_field( $data['name'] ) ) {
			return self::error();
		}
		return array(
			'name'             => sanitize_text_field( $data['name'] ),
			'status'           => $data['status'],
			'triggers'         => $data['triggers'],
			'conditions'       => $data['conditions'],
			'platforms'        => $data['platforms'],
			'once_per_session' => $data['once_per_session'],
		);
	}
	/**
	 * Service operation.
	 *
	 * @param array<string,mixed> $v Trigger.
	 * @return bool
	 */
	private static function trigger( array $v ): bool {
		if ( array_diff( array_keys( $v ), array( 'type', 'operator', 'value', 'key', 'delay' ) ) || ! is_string( $v['type'] ?? null ) || ( isset( $v['delay'] ) && ( ! is_int( $v['delay'] ) || $v['delay'] < 0 || $v['delay'] > 3600 ) ) ) {
			return false;
		}
		$type  = $v['type'];
		$value = $v['value'] ?? '';
		if ( 'home' === $type ) {
			return true;
		}
		if ( in_array( $type, array( 'scroll', 'time', 'page_count' ), true ) ) {
			return is_int( $value ) && $value >= 1 && $value <= ( 'scroll' === $type ? 100 : 3600 );
		}
		if ( ! is_string( $value ) || strlen( $value ) > 512 ) {
			return false;
		}
		if ( in_array( $type, array( 'click', 'mouseover', 'visible' ), true ) ) {
			return self::selector( $value );
		}
		if ( in_array( $type, array( 'url', 'link' ), true ) ) {
			return '' !== $value && in_array( $v['operator'] ?? null, array( 'equals', 'contains', 'starts', 'regex' ), true ) && ( 'regex' !== $v['operator'] || self::regex( $value ) );
		}
		if ( 'post_type' === $type ) {
			return (bool) preg_match( '/\A[a-z0-9_-]{1,32}\z/', $value );
		}
		if ( 'posts' === $type ) {
			return (bool) preg_match( '/\A[1-9][0-9]*(?:,[1-9][0-9]*){0,49}\z/', $value );
		}
		if ( 'terms' === $type ) {
			return (bool) preg_match( '/\A[a-z0-9_-]{1,32}:[1-9][0-9]*\z/', $value );
		}
		return 'url_param' === $type && is_string( $v['key'] ?? null ) && preg_match( '/\A[a-zA-Z0-9_-]{1,64}\z/', $v['key'] ) && in_array( $v['operator'] ?? null, array( 'present', 'equals' ), true );
	}
	/**
	 * Service operation.
	 *
	 * @param array<string,mixed> $v Condition.
	 * @return bool
	 */
	private static function condition( array $v ): bool {
		if ( array_diff( array_keys( $v ), array( 'type', 'value' ) ) || ! is_string( $v['type'] ?? null ) || ! is_string( $v['value'] ?? null ) || '' === $v['value'] || strlen( $v['value'] ) > 256 ) {
			return false;
		}
		if ( 'device' === $v['type'] ) {
			return in_array( $v['value'], array( 'desktop', 'mobile', 'tablet' ), true );
		}
		if ( 'role' === $v['type'] ) {
			return 'logged-out' === $v['value'] || (bool) preg_match( '/\A[a-zA-Z0-9_-]{1,64}\z/', $v['value'] );
		}
		if ( 'referrer_domain' === $v['type'] ) {
			return (bool) preg_match( '/\A[a-zA-Z0-9.-]{1,253}\z/', $v['value'] );
		}
		return in_array( $v['type'], array( 'url_contains', 'url_not_contains', 'utm_source', 'utm_medium', 'utm_campaign' ), true );
	}
	/**
	 * Service operation.
	 *
	 * @param string $value Expression limited to literals, anchors and one dot-star wildcard.
	 * @return bool
	 */
	public static function regex( string $value ): bool {
		if ( strlen( $value ) > 256 || substr_count( $value, '.*' ) > 1 ) {
			return false;
		}
		$literal = str_replace( array( '.*', '\\.', '\\/', '\\?', '\\-', '\\&', '\\=' ), '', $value );
		return ! preg_match( '/[\\\\()\[\]{}+?*|]/', $literal ) && false !== @preg_match( '~' . str_replace( '~', '\\~', $value ) . '~', '' ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- Invalid admin regexes return a validation error, never a PHP warning.
	}
	/**
	 * Service operation.
	 *
	 * @param string $value Basic tag/id/class selectors, descendants, children and comma lists.
	 * @return bool
	 */
	public static function selector( string $value ): bool {
		if ( '' === trim( $value ) || strlen( $value ) > 256 ) {
			return false;
		}
		$groups = explode( ',', $value );
		foreach ( $groups as $group ) {
			$parts = preg_split( '/\s*>\s*|\s+/', trim( $group ) );
			if ( ! $parts ) {
				return false;
			}
			foreach ( $parts as $part ) {
				if ( '' === $part || ! preg_match( '/\A(?:[a-zA-Z][a-zA-Z0-9_-]*|\*)?(?:[.#][a-zA-Z_][a-zA-Z0-9_-]*)*\z/', $part ) ) {
						return false;
				}
			}
		}return true;
	}
	/**
	 * Service operation.
	 *
	 * @return \WP_Error Safe validation message.
	 */
	private static function error(): \WP_Error {
		return new \WP_Error( 'pixelpair_invalid_rule', __( 'Invalid event rule. Check triggers, conditions and platform parameters.', 'pixelpair' ), array( 'status' => 400 ) );
	}
}
