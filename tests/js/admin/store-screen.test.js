import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createRegistry, RegistryProvider } from '@wordpress/data';
import App from '../../../assets/src/admin/App';
import { createSettingsStore } from '../../../assets/src/admin/data/settings';
const storeSettings = {
	enabled: false,
	content_id: 'id',
	id_prefix: 'catalog_',
	id_suffix: '',
	parent_ids: false,
	include_tax: true,
	include_shipping: true,
	include_fees: true,
	non_purchase_percent: 100,
	list_limit: 20,
	add_to_cart_source: 'hook',
	attribution: true,
	hide_attribution: false,
	safety_net: true,
	renewals: false,
	events: {
		view_item: true,
		view_item_list: true,
		add_to_cart: true,
		view_cart: true,
		begin_checkout: true,
		add_payment_info: true,
		add_shipping_info: true,
		purchase: true,
		refund: false,
	},
};
function mount(
	stores = { woocommerce: true, edd: true },
	provider = 'woocommerce'
) {
	window.pixelpairAdmin = { ...window.pixelpairAdmin, stores };
	window.history.replaceState( null, '', `#/store/${ provider }` );
	const initial = {
		onboarding_complete: true,
		meta_enabled: true,
		woocommerce: storeSettings,
		edd: { ...storeSettings, id_prefix: 'downloads_' },
	};
	let current = initial;
	const request = jest.fn().mockImplementation( async ( req ) => {
		current = { ...current, ...req.data };
		return current;
	} );
	const registry = createRegistry();
	registry.register( createSettingsStore( request ) );
	render(
		<RegistryProvider value={ registry }>
			<App />
		</RegistryProvider>
	);
	return request;
}
test( 'WooCommerce saves only its changed fields and preserves hidden options and the other store', async () => {
	const request = mount();
	await screen.findByRole( 'heading', { name: 'WooCommerce', level: 1 } );
	expect( screen.getByLabelText( 'Product ID prefix' ) ).not.toBeVisible();
	fireEvent.click( screen.getByLabelText( 'Track store events' ) );
	fireEvent.click( screen.getByLabelText( 'Purchases' ) );
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await waitFor( () => expect( request ).toHaveBeenCalledTimes( 2 ) );
	expect( Object.keys( request.mock.calls[ 1 ][ 0 ].data ) ).toEqual( [
		'woocommerce',
	] );
	expect( request.mock.calls[ 1 ][ 0 ].data.woocommerce ).toEqual( {
		...storeSettings,
		enabled: true,
		events: { ...storeSettings.events, purchase: false },
	} );
} );
test( 'WooCommerce rejects out-of-range amounts and provides a useful absent-store state', async () => {
	const request = mount();
	await screen.findByLabelText( 'Track store events' );
	fireEvent.click( screen.getByText( 'Advanced', { exact: true } ) );
	fireEvent.change(
		screen.getByLabelText( 'Non-purchase value percentage' ),
		{ target: { value: '10001' } }
	);
	expect(
		screen.getByRole( 'button', { name: 'Save changes' } )
	).toBeDisabled();
	expect( request ).toHaveBeenCalledTimes( 1 );
} );
test( 'a direct Store route with no store installed shows a next action', async () => {
	mount( {} );
	await screen.findByText(
		'Activate WooCommerce or Easy Digital Downloads to configure store tracking.'
	);
	expect(
		screen.getByRole( 'button', { name: 'Open Connections' } )
	).toBeVisible();
	expect(
		screen.queryByLabelText( 'Track store events' )
	).not.toBeInTheDocument();
} );
test( 'EDD saves its own provider and does not offer unsupported shipping controls', async () => {
	const request = mount( { edd: true, woocommerce: true }, 'edd' );
	await screen.findByRole( 'heading', {
		name: 'Easy Digital Downloads',
		level: 1,
	} );
	expect(
		screen.queryByLabelText( 'Include shipping' )
	).not.toBeInTheDocument();
	expect(
		screen.queryByLabelText( 'Shipping selection' )
	).not.toBeInTheDocument();
	fireEvent.click( screen.getByLabelText( 'Track store events' ) );
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await waitFor( () => expect( request ).toHaveBeenCalledTimes( 2 ) );
	expect( request.mock.calls[ 1 ][ 0 ].data ).toEqual( {
		edd: { ...storeSettings, id_prefix: 'downloads_', enabled: true },
	} );
} );
