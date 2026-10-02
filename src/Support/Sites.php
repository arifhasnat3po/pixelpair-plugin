<?php
/**
 * Bounded site enumeration and safe blog-context switching.
 *
 * @package PixelPair
 */

declare(strict_types=1);

namespace PixelPair\Support;

/** Isolate operations between WordPress sites. */
final class Sites {
	/**
	 * Apply a site-local operation with guaranteed context restoration.
	 *
	 * @param int      $blog_id Site ID.
	 * @param callable $action Operation to run in that site.
	 */
	public static function on_site( int $blog_id, callable $action ): void {
		if ( get_current_blog_id() === $blog_id ) {
			$action();
			return;
		}
		switch_to_blog( $blog_id );
		try {
			$action();
		} finally {
			restore_current_blog();
		}
	}

	/**
	 * Visit sites in bounded batches, without loading every site in memory.
	 *
	 * @param callable $action     Site-local operation.
	 * @param int      $network_id Network ID, or zero for all networks.
	 */
	public static function each( callable $action, int $network_id = 0 ): void {
		if ( ! is_multisite() ) {
			$action();
			return;
		}
		$offset = 0;
		do {
			$args = array(
				'fields'  => 'ids',
				'number'  => 100,
				'offset'  => $offset,
				'orderby' => 'id',
				'order'   => 'ASC',
			);
			if ( $network_id ) {
				$args['network_id'] = $network_id;
			}
			/** Site IDs returned by the fields=ids query.
			 *
		 * @var list<int> $ids
		 */
			$ids = get_sites( $args );
			foreach ( $ids as $blog_id ) {
				self::on_site( (int) $blog_id, $action );
			}
			$count   = count( $ids );
			$offset += $count;
		} while ( 100 === $count );
	}
}
