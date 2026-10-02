<?php
/** Test-only stand-ins for documented optional plugin signals. */
namespace {
	function bricks_is_builder() { return 'bricks' === ( $GLOBALS['pixelpair_test_context'] ?? '' ); }
	function amp_is_request() { return 'amp' === ( $GLOBALS['pixelpair_test_context'] ?? '' ); }
	class FLBuilderModel { public static function is_builder_active() { return 'beaver' === ( $GLOBALS['pixelpair_test_context'] ?? '' ); } }
}
namespace Elementor {
	class Plugin { public static $instance; }
	Plugin::$instance = (object) array(
		'editor' => new class { public function is_edit_mode() { return 'elementor-editor' === ( $GLOBALS['pixelpair_test_context'] ?? '' ); } },
		'preview' => new class { public function is_preview_mode() { return 'elementor-preview' === ( $GLOBALS['pixelpair_test_context'] ?? '' ); } },
	);
}
