<?php
/**
 * Site-owner permission management.
 *
 * @package PixelPair
 */

declare (strict_types=1);
namespace PixelPair\Admin;

/** Only site administrators can delegate PixelPair management. */
final class PermissionsController {

	/** Register grants endpoint. */
	public function register_routes(): void {
		register_rest_route(
			'pixelpair/v1',
			'/permissions',
			array(
				'methods'             => array( 'GET', 'POST' ),
				'permission_callback' => array( $this, 'permissions' ),
				'callback'            => array( $this, 'handle' ),
			)
		);
	}
	/**
	 * Check nonce and site-owner authority.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return true|\WP_Error
	 */
	public function permissions( \WP_REST_Request $request ) {
		return current_user_can( 'manage_options' ) && ( new SettingsController() )->permissions( $request ) === true ? true : self::error();
	}
	/**
	 * Read selected roles.
	 *
	 * @return list<string>
	 */
	public function roles(): array {
		$out = array();
		foreach ( array_keys( wp_roles()->roles ) as $slug ) {
			if ( get_role( $slug )->has_cap( 'manage_pixelpair' ) ) {
				$out[] = $slug;
			}
		}
		return $out;
	}
	/**
	 * Validate all roles, preserve the administrator capability.
	 *
	 * @param array<mixed> $roles Role slugs.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function save( array $roles ) {
		if ( ! current_user_can( 'manage_options' ) || ! current_user_can( 'manage_pixelpair' ) ) {
			return self::error();
		}
		if ( count( $roles ) > 100 || array_values( $roles ) !== $roles ) {
			return self::error();
		}
		foreach ( $roles as $role ) {
			if ( ! is_string( $role ) || ! get_role( $role ) ) {
				return self::error();
			}
		}
		$roles[] = 'administrator';
		foreach ( array_keys( wp_roles()->roles ) as $slug ) {
			$role = get_role( $slug );
			if ( in_array( $slug, $roles, true ) ) {
				$role->add_cap( 'manage_pixelpair' );
			} else {
				$role->remove_cap( 'manage_pixelpair' );
			}
		}
		return array( 'roles' => $this->roles() );
	}
	/**
	 * Read or save grants.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function handle( \WP_REST_Request $request ) {
		$data   = strlen( $request->get_body() ) <= 8192 ? json_decode( $request->get_body(), true ) : null;
		$result = 'POST' === $request->get_method() ? is_array( $data ) && array_keys( $data ) === array( 'roles' ) && is_array( $data['roles'] ) ? $this->save( $data['roles'] ) : self::error() : array( 'roles' => $this->roles() );
		return is_wp_error( $result ) ? $result : new \WP_REST_Response( $result, 200, \PixelPair\Events\BootstrapController::headers() );
	}
	/**
	 * Explain a rejected grant change.
	 *
	 * @return \WP_Error Permission error.
	 */
	private static function error(): \WP_Error {
		return new \WP_Error( 'pixelpair_permissions', __( 'Only a site administrator can assign valid PixelPair roles. Administrator access is always retained.', 'pixelpair' ), array( 'status' => 403 ) );
	}
}
