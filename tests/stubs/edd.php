<?php

/**
 * Analysis-only subset verified against EDD 3.7.1's public APIs. Never loaded at runtime.
 */
namespace EDD\Orders {
    /**
     * Apply the validated configuration.
     * 
     *
 * @property int $id
 * @property int $user_id
 * @property int $parent
 * @property string $type
 * @property string $status
 * @property string $email
 * @property string $currency
 * @property string $payment_key
 * @property float $total
 * @property float $tax
     */
    class Order
    {
        /**
         * Apply the validated configuration.
         * 
         * @return list<Order_Item>
         */
        public function get_items()
        {
        }
        /**
         * Apply the validated configuration.
         * 
         * @return list<Order_Adjustment>
         */
        public function get_fees()
        {
        }
        /**
         * Apply the validated configuration.
         * 
         * @return list<Order_Adjustment>
         */
        public function get_discounts()
        {
        }
        public function is_receipt_hash_valid(string $hash): bool
        {
        }
    }
    /**
     * Apply the validated configuration.
     * 
     *
 * @property int $product_id
 * @property int $quantity
 * @property int|null $price_id
 * @property string $product_name
 * @property float $subtotal
 * @property float $discount
 * @property float $tax
     */
    class Order_Item
    {
    }
    /**
     * Apply the validated configuration.
     * 
     *
 * @property float $subtotal
 * @property string $description
     */
    class Order_Adjustment
    {
    }
}
namespace {
    class EDD_Download
    {
        /**
         * Apply the validated configuration.
         * 
         * @var int
         */
        public $ID;
        public function __construct(int $id)
        {
        }
        /**
         * Apply the validated configuration.
         * 
         * @return string|false
         */
        public function get_sku()
        {
        }
        public function has_variable_prices(): bool
        {
        }
        public function get_default_price_id(): int
        {
        }
        /**
         * Apply the validated configuration.
         * 
         * @return array<int,array<string,mixed>>
         */
        public function get_prices()
        {
        }
    }
    class PixelPair_EDD_Session_Stub
    {
        /**
         * Apply the validated configuration.
         * 
         * @return mixed
         */
        public function get(string $key)
        {
        }
        /**
         * Apply the validated configuration.
         * 
         * @param mixed $value
         */
        public function set(string $key, $value): void
        {
        }
    }
    class PixelPair_EDD_Cart_Stub
    {
        /**
         * Apply the validated configuration.
         * 
         * @return list<string>
         */
        public function get_discounts()
        {
        }
    }
    class PixelPair_EDD_Stub
    {
        /**
         * Apply the validated configuration.
         * 
         * @var PixelPair_EDD_Session_Stub|null
         */
        public $session;
        /**
         * Apply the validated configuration.
         * 
         * @var PixelPair_EDD_Cart_Stub
         */
        public $cart;
    }
    function EDD(): PixelPair_EDD_Stub
    {
    }
    /** @param mixed $default @return mixed */ function edd_get_option(string $key,$default=null) {}
    function edd_get_currency(): string
    {
    }
    /**
     * Apply the validated configuration.
     * 
     * @param array<string,mixed> $options
     */
    function edd_get_cart_item_price(int $id, array $options, bool $remove_tax = false): float
    {
    }
    /**
     * Apply the validated configuration.
     * 
     * @param array<string,mixed> $options
     */
    function edd_get_cart_item_tax(int $id, array $options, float $subtotal): float
    {
    }
    /**
     * Apply the validated configuration.
     * 
     * @return list<array<string,mixed>>
     */
    function edd_get_cart_content_details()
    {
    }
    function edd_get_cart_tax(): float
    {
    }
    function edd_get_cart_fee_total(): float
    {
    }
    function edd_get_cart_total(): float
    {
    }
    /**
     * Apply the validated configuration.
     * 
     * @return \EDD\Orders\Order|false
     */
    function edd_get_order(int $id)
    {
    }
    /**
     * Apply the validated configuration.
     * 
     * @param mixed $value
     * @return \EDD\Orders\Order|false
     */
    function edd_get_order_by(string $field, $value)
    {
    }
    /**
     * Apply the validated configuration.
     * 
     * @param \EDD\Orders\Order $order
     */
    function edd_can_view_receipt($order): bool
    {
    }
    /**
     * Apply the validated configuration.
     * 
     * @return array<string,mixed>|false
     */
    function edd_get_purchase_session()
    {
    }
    /**
     * Apply the validated configuration.
     * 
     * @param mixed $value
     */
    function edd_update_order_meta(int $id, string $key, $value): bool
    {
    }
    /**
     * Apply the validated configuration.
     * 
     * @return mixed
     */
    function edd_get_order_meta(int $id, string $key, bool $single = false)
    {
    }
    /**
     * Apply the validated configuration.
     * 
     * @return array<string,array<string,mixed>>
     */
    function edd_get_enabled_payment_gateways()
    {
    }
    function edd_is_success_page(): bool
    {
    }
    function edd_is_checkout(): bool
    {
    }

    function edd_delete_order_meta(int $id,string $key): bool {}
}
