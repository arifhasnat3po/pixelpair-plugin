import { useState } from '@wordpress/element';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
	Button,
	Field,
	SaveBar,
	ToggleRow,
	MatchIndicator,
	useUnsavedChanges,
} from '../../../assets/src/admin/components/ui';
import {
	IdField,
	SecretField,
	validId,
} from '../../../assets/src/admin/components/ui/fields';

test( 'Google IDs match the existing server length and count limits', () => {
	expect( validId( 'ga4', 'G-X', true ) ).toBe( false );
	expect( validId( 'gtm', 'GTM-X', true ) ).toBe( false );
	expect(
		validId( 'ga4', Array( 11 ).fill( 'G-ABCD' ).join( ',' ), true )
	).toBe( false );
	expect( validId( 'ga4', 'G-ABCD', true ) ).toBe( true );
} );

test( 'typing multiple Google IDs preserves separators and an unfinished second ID', () => {
	function Input() {
		const [ ids, setIds ] = useState( [] );
		return (
			<IdField
				platform="ga4"
				value={ ids.join( ', ' ) }
				onChange={ ( text ) =>
					setIds( text.split( /[,\s]+/ ).filter( Boolean ) )
				}
			/>
		);
	}
	render( <Input /> );
	const input = screen.getByLabelText( 'Measurement IDs' );
	fireEvent.focus( input );
	for ( const character of 'G-ABCD, G-EFGH' ) {
		fireEvent.change( input, {
			target: { value: input.value + character },
		} );
	}
	expect( input ).toHaveValue( 'G-ABCD, G-EFGH' );
	fireEvent.blur( input );
	expect( input ).toHaveValue( 'G-ABCD, G-EFGH' );
} );

test( 'field preserves help and validation associations', () => {
	render(
		<Field
			label="Pixel ID"
			help="Find your pixel."
			error="Enter a valid ID."
		>
			<input />
		</Field>
	);
	const input = screen.getByLabelText( 'Pixel ID' );
	expect( input ).toHaveAccessibleDescription(
		'Find your pixel. Enter a valid ID.'
	);
	expect( input ).toHaveAttribute( 'aria-invalid', 'true' );
} );

test( 'busy action blocks repeated activation and exposes its current label', () => {
	const action = jest.fn();
	render(
		<Button busy busyLabel="Checking…" onClick={ action }>
			Check connection
		</Button>
	);
	const button = screen.getByRole( 'button', { name: 'Checking…' } );
	fireEvent.click( button );
	expect( button ).toBeDisabled();
	expect( action ).not.toHaveBeenCalled();
} );

test( 'Meta snippet is extracted without executing pasted HTML', () => {
	function Input() {
		const [ value, setValue ] = useState( '' );
		return (
			<IdField platform="meta" value={ value } onChange={ setValue } />
		);
	}
	render( <Input /> );
	fireEvent.change( screen.getByLabelText( 'Pixel ID' ), {
		target: {
			value: '<script>fbq("init", "0123456789012345");window.bad=true;</script>',
		},
	} );
	expect( screen.getByLabelText( 'Pixel ID' ) ).toHaveValue(
		'0123456789012345'
	);
	expect( screen.getByRole( 'status' ) ).toHaveTextContent(
		'0123456789012345'
	);
	expect( window.bad ).toBeUndefined();
} );

test( 'ambiguous Meta snippets cannot silently choose the wrong account', () => {
	render( <IdField platform="meta" value="" onChange={ () => {} } /> );
	fireEvent.change( screen.getByLabelText( 'Pixel ID' ), {
		target: {
			value: 'fbq("init","123456789012345");fbq("init","987654321098765");',
		},
	} );
	expect( screen.getByRole( 'alert' ) ).toHaveTextContent( /more than one/i );
} );

test( 'Google code extracts measurement IDs and does not confuse a container ID', () => {
	const change = jest.fn();
	render( <IdField platform="ga4" value="" onChange={ change } /> );
	fireEvent.change( screen.getByLabelText( 'Measurement IDs' ), {
		target: {
			value: "gtag('config', 'G-ABC123');gtag('config', 'G-DEF456');GTM-IGNORE",
		},
	} );
	expect( change ).toHaveBeenLastCalledWith( 'G-ABC123, G-DEF456' );
} );

test( 'stored secret stays masked until the user chooses replacement', () => {
	render( <SecretField configured value="" onChange={ () => {} } /> );
	expect( screen.queryByLabelText( 'Access token' ) ).not.toBeInTheDocument();
	fireEvent.click( screen.getByRole( 'button', { name: 'Replace token' } ) );
	expect( screen.getByLabelText( 'Access token' ) ).toHaveAttribute(
		'type',
		'password'
	);
	expect( screen.getByLabelText( 'Access token' ) ).toHaveValue( '' );
} );

test( 'clean forms have no save bar, dirty forms expose save and discard', () => {
	const { rerender } = render( <SaveBar dirty={ false } /> );
	expect(
		screen.queryByRole( 'button', { name: 'Save changes' } )
	).not.toBeInTheDocument();
	const discard = jest.fn();
	rerender( <SaveBar dirty onDiscard={ discard } /> );
	fireEvent.click( screen.getByRole( 'button', { name: 'Discard' } ) );
	expect( discard ).toHaveBeenCalledTimes( 1 );
} );

test( 'toggle saves immediately and Undo restores the previous choice', async () => {
	const changes = [];
	function Row() {
		const [ checked, setChecked ] = useState( true );
		return (
			<ToggleRow
				label="Form submissions"
				checked={ checked }
				onChange={ async ( next ) => {
					changes.push( next );
					setChecked( next );
					return true;
				} }
			/>
		);
	}
	render( <Row /> );
	fireEvent.click(
		screen.getByRole( 'checkbox', { name: 'Form submissions' } )
	);
	fireEvent.click( await screen.findByRole( 'button', { name: 'Undo' } ) );
	await waitFor( () =>
		expect( screen.getByRole( 'checkbox' ) ).toBeChecked()
	);
	expect( changes ).toEqual( [ false, true ] );
} );

test( 'unknown browser and server receipt never claims a verified match', () => {
	render( <MatchIndicator /> );
	expect( screen.getByText( 'Match not verified' ) ).toBeVisible();
	expect(
		screen.queryByText( 'Matched', { exact: true } )
	).not.toBeInTheDocument();
} );

test( 'a dirty sibling cannot erase another resource’s busy navigation guard', () => {
	function Guard( { busy } ) {
		useUnsavedChanges( true, busy );
		return null;
	}
	render(
		<div>
			<Guard busy />
			<Guard busy={ false } />
		</div>
	);
	const event = new CustomEvent( 'pixelpair:before-route', {
		cancelable: true,
		detail: { busy: false },
	} );
	expect( window.dispatchEvent( event ) ).toBe( false );
	expect( event.detail.busy ).toBe( true );
} );
