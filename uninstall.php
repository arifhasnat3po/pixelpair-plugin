<?php
/**
 * WordPress uninstall entry point; still works if vendor files are missing.
 *
 * @package PixelPair
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

require_once __DIR__ . '/src/Support/Sites.php';
require_once __DIR__ . '/src/Deactivation.php';
require_once __DIR__ . '/src/Uninstall.php';

\PixelPair\Uninstall::run();
