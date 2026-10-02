<?php
/**
 * Normalize matching values before hashing.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\UserData;

/** Conservative normalization; unknown or ambiguous values are omitted. */
final class Normalizer {
	/**
	 * Service operation.
	 *
	 * @param string $field Meta matching key.
	 * @param string $value Raw value.
	 * @return string
	 */
	public static function normalize( string $field, string $value ): string {
		$value = trim( $value );
		if ( strlen( $value ) > 512 ) {
			return '';
		}
		if ( 'external_id' === $field ) {
			return $value;
		}
		$value = function_exists( 'mb_strtolower' ) ? mb_strtolower( $value, 'UTF-8' ) : strtolower( $value );
		if ( 'em' === $field ) {
			return is_email( $value ) ? $value : '';
		}
		if ( 'ph' === $field ) {
			if ( preg_match( '/[^0-9+().\s-]/', $value ) ) {
				return '';
			}
			$value = (string) preg_replace( '/\D/', '', $value );
			return preg_match( '/\A[1-9][0-9]{6,14}\z/', $value ) ? $value : '';
		}
		if ( 'country' === $field ) {
			$countries = 'ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw';
			return in_array( $value, explode( ' ', $countries ), true ) ? $value : '';
		}
		if ( 'db' === $field ) {
			$value = str_replace( '-', '', $value );
			return preg_match( '/\A[0-9]{8}\z/', $value ) && checkdate( (int) substr( $value, 4, 2 ), (int) substr( $value, 6, 2 ), (int) substr( $value, 0, 4 ) ) && $value <= gmdate( 'Ymd' ) ? $value : '';
		}
		if ( 'ge' === $field ) {
			return in_array( $value, array( 'm', 'f' ), true ) ? $value : '';
		}
		if ( in_array( $field, array( 'fn', 'ln', 'ct', 'st', 'zp' ), true ) ) {
			return (string) preg_replace( '/[^\p{L}\p{N}]/u', '', $value );
		}
		return '';
	}
	/**
	 * Service operation.
	 *
	 * @param array<string, mixed> $raw Raw matching fields.
	 * @return array<string, list<string>>
	 */
	public static function hashes( array $raw ): array {
		$out = array();
		foreach ( $raw as $field => $value ) {
			if ( ! is_string( $value ) ) {
				continue;
			}
			$normal = self::normalize( $field, $value );
			if ( '' !== $normal ) {
				$out[ $field ] = array( hash( 'sha256', $normal ) );
			}
		}
		return $out;
	}
}
