<?php
/**
 * Public document context, never visitor attribution.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events\Automatic;

/** Read the current WordPress query and already primed term caches without issuing SQL. */
final class Context {
	/**
	 * Service operation.
	 *
	 * @return array<string,mixed> Visitor-neutral document metadata.
	 */
	public static function page(): array {
		global $post;
		$out = array(
			'home'          => is_front_page(),
			'not_found'     => is_404(),
			'post_id'       => 0,
			'post_type'     => '',
			'post_title'    => '',
			'categories'    => array(),
			'tags'          => array(),
			'term_ids'      => array(),
			'search_string' => is_search() ? mb_substr( get_search_query( false ), 0, 256 ) : '',
		);
		if ( is_singular() && $post instanceof \WP_Post ) {
			$out['post_id']    = (int) $post->ID;
			$out['post_type']  = $post->post_type;
			$out['post_title'] = wp_strip_all_tags( $post->post_title );
			foreach ( get_object_taxonomies( $post->post_type ) as $taxonomy ) {
				$key = array(
					'category' => 'categories',
					'post_tag' => 'tags',
				)[ $taxonomy ] ?? '';
				$ids = wp_cache_get( $post->ID, $taxonomy . '_relationships' );
				if ( ! is_array( $ids ) ) {
							continue;
				}
				foreach ( $ids as $id ) {
					$out['term_ids'][] = $taxonomy . ':' . $id;
					$term              = wp_cache_get( $id, 'terms' );
					if ( '' !== $key && is_object( $term ) && isset( $term->name ) ) {
								$out[ $key ][] = $term->name;
					}
				}
			}
		}return $out;
	}
}
