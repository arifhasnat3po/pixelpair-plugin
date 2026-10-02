/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, lazy } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Page, EmptyState, Button } from '../components/ui';
import { storeNames } from '../components/StoreScreen';
const WooCommerce = lazy( () => import( './WooCommerce' ) );
const EasyDigitalDownloads = lazy( () => import( './EasyDigitalDownloads' ) );
export default function Commerce( props ) {
	const stores = window.pixelpairAdmin?.stores || {};
	const provider =
		props.route.split( '/' )[ 1 ] ||
		Object.keys( storeNames ).find( ( key ) => stores[ key ] );
	if ( ! provider || ! stores[ provider ] ) {
		return (
			<Page title={ __( 'Store', 'pixelpair' ) }>
				<EmptyState
					action={
						<Button
							onClick={ () => props.navigate( 'connections' ) }
						>
							{ __( 'Open Connections', 'pixelpair' ) }
						</Button>
					}
				>
					{ __(
						'Activate WooCommerce or Easy Digital Downloads to configure store tracking.',
						'pixelpair'
					) }
				</EmptyState>
			</Page>
		);
	}
	if ( provider === 'woocommerce' ) {
		return <WooCommerce { ...props } />;
	}
	return <EasyDigitalDownloads { ...props } />;
}
