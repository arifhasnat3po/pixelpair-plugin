<?php
/**
 * Dismissible consent-tool recommendation.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Admin;

use PixelPair\Integrations\Consent\ConsentManager;
use PixelPair\Settings\Repository;

/** Help owners discover the default marketing consent policy. */
final class ConsentNotice {
	/** Render a notice only for authorized site owners without a detected CMP. */
	public function render(): void {
		if ( ! current_user_can( 'manage_pixelpair' ) || ( new Repository() )->get()['consent_notice_dismissed'] || ( new ConsentManager() )->tools() ) {
			return;
		}
		?>
		<div class="notice notice-info">
			<p><?php esc_html_e( 'PixelPair: no consent tool was detected. Marketing tracking is allowed by default when your pixel is enabled. For EU/UK traffic, we recommend a consent plugin. You can also turn on “Deny marketing until consent” in PixelPair.', 'pixelpair' ); ?></p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="pixelpair_dismiss_consent">
				<?php wp_nonce_field( 'pixelpair_dismiss_consent' ); ?>
				<p><button type="submit" class="button"><?php esc_html_e( 'Dismiss recommendation', 'pixelpair' ); ?></button></p>
			</form>
		</div>
		<?php
	}
	/**
	 * Persist dismissal only after capability and nonce verification.
	 *
	 * @param string $nonce Submitted action nonce.
	 * @return true|\WP_Error
	 */
	public function dismiss( string $nonce ) {
		if ( ! current_user_can( 'manage_pixelpair' ) || ! wp_verify_nonce( $nonce, 'pixelpair_dismiss_consent' ) ) {
			return new \WP_Error( 'pixelpair_forbidden', __( 'You cannot dismiss this recommendation.', 'pixelpair' ), array( 'status' => 403 ) );
		}
		$result = ( new Repository() )->update( array( 'consent_notice_dismissed' => true ) );
		return is_wp_error( $result ) ? $result : true;
	}
	/** Handle the authenticated admin form. */
	public function handle(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- The nonce is verified by dismiss().
		$nonce  = isset( $_POST['_wpnonce'] ) && is_string( $_POST['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_POST['_wpnonce'] ) ) : '';
		$result = $this->dismiss( $nonce );
		if ( is_wp_error( $result ) ) {
			wp_die( esc_html( $result->get_error_message() ), '', array( 'response' => 403 ) );
		}
		wp_safe_redirect( admin_url( 'admin.php?page=pixelpair' ) );
		exit;
	}
}
