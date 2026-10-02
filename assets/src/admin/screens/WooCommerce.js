/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement } from '@wordpress/element';
import StoreScreen from '../components/StoreScreen';
export default function WooCommerce( props ) {
	return <StoreScreen { ...props } provider="woocommerce" />;
}
