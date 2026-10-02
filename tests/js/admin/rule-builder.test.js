import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomEventEditor from '../../../assets/src/admin/screens/CustomEventEditor';
import { newRule } from '../../../assets/src/admin/data/customEvents';
test( 'a click Contact rule needs no payload typing and rejects unsupported selectors before saving', async () => {
	const save = jest.fn().mockResolvedValue( true );
	const completed = jest.fn();
	render(
		<CustomEventEditor
			initial={ newRule() }
			onSave={ save }
			onComplete={ completed }
			onCancel={ jest.fn() }
		/>
	);
	fireEvent.change( screen.getByLabelText( 'Event name' ), {
		target: { value: 'Book a call' },
	} );
	fireEvent.change( screen.getByLabelText( 'An element matching' ), {
		target: { value: 'button:has(script)' },
	} );
	expect( screen.getByLabelText( 'An element matching' ) ).toHaveAttribute(
		'aria-invalid',
		'true'
	);
	expect(
		screen.getByRole( 'button', { name: 'Save and turn on' } )
	).toBeDisabled();
	fireEvent.change( screen.getByLabelText( 'An element matching' ), {
		target: { value: '.book-call-btn' },
	} );
	fireEvent.click( screen.getByText( "Show what's sent", { exact: true } ) );
	expect( screen.getByText( /fbq\('track', "Contact"/ ) ).toBeInTheDocument();
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Save and turn on' } )
	);
	await waitFor( () => expect( completed ).toHaveBeenCalledTimes( 1 ) );
	expect( save.mock.calls[ 0 ][ 0 ] ).toMatchObject( {
		name: 'Book a call',
		status: 'active',
		triggers: [ { type: 'click', value: '.book-call-btn' } ],
		platforms: { meta: { name: 'Contact' } },
	} );
} );
test( 'failed event saves keep the draft and condition edits use the existing contract', async () => {
	const save = jest.fn().mockResolvedValue( false );
	const completed = jest.fn();
	render(
		<CustomEventEditor
			initial={ {
				...newRule(),
				id: 9,
				name: 'Existing rule',
				triggers: [
					{ type: 'url', operator: 'regex', value: '^/pricing.*' },
				],
			} }
			onSave={ save }
			onComplete={ completed }
			onCancel={ jest.fn() }
		/>
	);
	fireEvent.change( screen.getByLabelText( 'A URL matching' ), {
		target: { value: '(a+)+' },
	} );
	expect( screen.getByLabelText( 'A URL matching' ) ).toHaveAttribute(
		'aria-invalid',
		'true'
	);
	fireEvent.change( screen.getByLabelText( 'A URL matching' ), {
		target: { value: '^/offer.*' },
	} );
	fireEvent.click( screen.getByRole( 'button', { name: 'Add condition' } ) );
	fireEvent.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
	await waitFor( () => expect( save ).toHaveBeenCalledTimes( 1 ) );
	expect( screen.getByLabelText( 'A URL matching' ) ).toHaveValue(
		'^/offer.*'
	);
	expect( completed ).not.toHaveBeenCalled();
	expect( save.mock.calls[ 0 ][ 0 ].conditions ).toEqual( [
		{ type: 'device', value: 'desktop' },
	] );
} );
