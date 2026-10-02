<?php
/**
 * Platform-neutral event value object.
 *
 * @package PixelPair
 */

declare(strict_types=1);
namespace PixelPair\Events;

/** Carry an event without persisting or exposing visitor data. */
final class Event {
	/**
	 * Internal event name.
	 *
	 * @var string
	 */
	public $name;
	/**
	 * UUID created by the event source.
	 *
	 * @var string
	 */
	public $event_id;
	/**
	 * Unix event timestamp.
	 *
	 * @var int
	 */
	public $time;
	/**
	 * Source URL.
	 *
	 * @var string
	 */
	public $source_url;
	/**
	 * Platform-neutral parameters (value, currency, contents and custom fields).
	 *
	 * @var array<string, mixed>
	 */
	public $params;
	/**
	 * Raw matching strings, or explicitly prehashed arrays from the internal collector.
	 *
	 * @var array<string, mixed>
	 */
	public $user_data;
	/**
	 * Construct the event envelope. No browser ID is ever generated in PHP.
	 *
	 * @param string               $name Internal event name.
	 * @param string               $event_id Source-generated event ID.
	 * @param int                  $time Unix timestamp.
	 * @param string               $source_url Source URL.
	 * @param array<string, mixed> $params Event parameters.
	 * @param array<string, mixed> $user_data Matching data; adapters normalize and hash raw strings.
	 */
	public function __construct( string $name, string $event_id, int $time, string $source_url, array $params = array(), array $user_data = array() ) {
		$this->name       = $name;
		$this->event_id   = $event_id;
		$this->time       = $time;
		$this->source_url = \PixelPair\Support\Urls::public_url( $source_url );
		$this->params     = $params;
		$this->user_data  = $user_data;
	}
}
