import { render, screen } from '@testing-library/react';
import EventMapping from '../../../assets/src/admin/components/EventMapping';
test.each( [ true, false ] )(
	'payload preview applies saved context and sensitive filters (%s)',
	( sensitive ) => {
		const params = {
			page_title: 'Private page',
			content_name: 'Booking',
			currency: 'USD',
			value: 20,
		};
		const { container } = render(
			<EventMapping
				value={ {
					meta: {
						enabled: true,
						name: 'Contact',
						server: true,
						params,
					},
					ga4: { enabled: true, name: 'generate_lead', params },
				} }
				onChange={ jest.fn() }
				settings={ {
					context_parameters: [],
					meta_sensitive_data: sensitive,
				} }
			/>
		);
		expect( screen.getByText( "Show what's sent" ) ).toBeInTheDocument();
		const previews = container.querySelectorAll( '.pixelpair-payload pre' );
		expect( previews[ 0 ] ).not.toHaveTextContent( 'Private page' );
		expect( previews[ 1 ] ).not.toHaveTextContent( 'Private page' );
		expect( previews[ 1 ] ).toHaveTextContent( 'Booking' );
		expect( previews[ 0 ].textContent.includes( 'Booking' ) ).toBe(
			! sensitive
		);
		expect( previews[ 0 ] ).toHaveTextContent( 'USD' );
	}
);
