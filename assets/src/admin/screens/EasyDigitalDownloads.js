/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement } from '@wordpress/element';
import StoreScreen from '../components/StoreScreen';
export default function EasyDigitalDownloads( props ) {
	return <StoreScreen { ...props } provider="edd" />;
}
