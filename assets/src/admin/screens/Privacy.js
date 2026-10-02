/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Page, Section, SaveBar, Feedback } from '../components/ui';
import { CheckField, TextField } from '../components/ui/fields';
import { useDraft } from '../data/useDraft';
import { validIpRange } from '../data/privacy';
const services = {
	borlabs_marketing: __( 'Borlabs marketing service ID', 'pixelpair' ),
	borlabs_statistics: __( 'Borlabs statistics service ID', 'pixelpair' ),
	rcb_marketing: __(
		'Real Cookie Banner marketing service name',
		'pixelpair'
	),
	rcb_statistics: __(
		'Real Cookie Banner statistics service name',
		'pixelpair'
	),
};
const keys = [
	'deny_until_consent',
	'google_consent_denied',
	'google_wait_for_update',
	'excluded_roles',
	'excluded_ips_text',
	'exclude_bots',
	...Object.keys( services ),
];
export default function Privacy( { settings, save, error } ) {
	const source = {
		...settings,
		excluded_ips_text: settings.excluded_ips.join( '\n' ),
	};
	const write = ( patch ) => {
		const { excluded_ips_text: ips, ...values } = patch;
		return save( {
			...values,
			...( ips !== undefined
				? {
						excluded_ips: ips
							.split( /\r?\n/ )
							.map( ( value ) => value.trim() )
							.filter( Boolean ),
					}
				: {} ),
		} );
	};
	const draft = useDraft( source, keys, write );
	const value = draft.values;
	const ips = value.excluded_ips_text
		.split( /\r?\n/ )
		.map( ( item ) => item.trim() )
		.filter( Boolean );
	const validIps = ips.length <= 100 && ips.every( validIpRange );
	const validWait =
		Number.isInteger( value.google_wait_for_update ) &&
		value.google_wait_for_update >= 0 &&
		value.google_wait_for_update <= 2000;
	const validService = ( service ) =>
		/^[A-Za-z0-9_-]{0,100}$/.test( service );
	const valid =
		validIps &&
		validWait &&
		Object.keys( services ).every( ( key ) =>
			validService( value[ key ] )
		);
	return (
		<Page
			title={ __( 'Privacy', 'pixelpair' ) }
			description={ __(
				'Choose when tracking is allowed and whose visits to exclude.',
				'pixelpair'
			) }
		>
			{ error && <Feedback error message={ error } /> }
			{ draft.message && <Feedback message={ draft.message } /> }
			<form
				onSubmit={ ( event ) => {
					event.preventDefault();
					if ( valid ) {
						draft.submit();
					}
				} }
			>
				<fieldset
					className="pixelpair-fieldset"
					disabled={ draft.busy }
				>
					<Section
						title={ __( 'Consent', 'pixelpair' ) }
						description={ __(
							'Detected consent tools control tracking; unresolved decisions keep pixels off.',
							'pixelpair'
						) }
					>
						<CheckField
							label={ __(
								'Wait for marketing consent',
								'pixelpair'
							) }
							checked={ value.deny_until_consent }
							onChange={ ( next ) =>
								draft.change( 'deny_until_consent', next )
							}
							help={ __(
								'Keep Meta and TikTok off until consent, even without a detected consent tool.',
								'pixelpair'
							) }
						/>
						<CheckField
							label={ __(
								'Wait for Google consent',
								'pixelpair'
							) }
							checked={ value.google_consent_denied }
							onChange={ ( next ) =>
								draft.change( 'google_consent_denied', next )
							}
							help={ __(
								'Start Google consent as denied until the visitor makes a choice.',
								'pixelpair'
							) }
						/>
						<p className="pixelpair-helper">
							{ value.deny_until_consent
								? __(
										'Marketing waits for consent. Configure your consent plugin to share the visitor’s choice.',
										'pixelpair'
									)
								: __(
										'If no consent tool is found, marketing tracking is allowed.',
										'pixelpair'
									) }
						</p>
					</Section>
					<Section
						title={ __( 'Don’t track', 'pixelpair' ) }
						description={ __(
							'These exclusions apply across your enabled connections.',
							'pixelpair'
						) }
					>
						<fieldset className="pixelpair-fieldset pixelpair-fields">
							<legend>
								{ __( 'Logged-in roles', 'pixelpair' ) }
							</legend>
							{ ( window.pixelpairAdmin?.roles || [] ).map(
								( role ) => (
									<CheckField
										key={ role.slug }
										label={ role.name }
										checked={ value.excluded_roles.includes(
											role.slug
										) }
										onChange={ ( checked ) =>
											draft.change(
												'excluded_roles',
												checked
													? [
															...value.excluded_roles,
															role.slug,
														]
													: value.excluded_roles.filter(
															( slug ) =>
																slug !==
																role.slug
														)
											)
										}
									/>
								)
							) }
						</fieldset>
						<TextField
							label={ __( 'IP addresses', 'pixelpair' ) }
							multiline
							rows={ 4 }
							value={ value.excluded_ips_text }
							onChange={ ( next ) =>
								draft.change( 'excluded_ips_text', next )
							}
							help={ __(
								'One IPv4, IPv6 or CIDR range per line; up to 100.',
								'pixelpair'
							) }
							error={
								! validIps
									? __(
											'Enter valid IP addresses or CIDR ranges, with no more than 100 lines.',
											'pixelpair'
										)
									: ''
							}
							spellCheck={ false }
						/>
						<CheckField
							label={ __( 'Exclude known bots', 'pixelpair' ) }
							checked={ value.exclude_bots }
							onChange={ ( next ) =>
								draft.change( 'exclude_bots', next )
							}
							help={ __(
								'Filter known crawler and bot user agents from tracking.',
								'pixelpair'
							) }
						/>
					</Section>
					<Section advanced>
						<TextField
							label={ __(
								'Google consent wait (milliseconds)',
								'pixelpair'
							) }
							type="number"
							min="0"
							max="2000"
							value={ value.google_wait_for_update }
							onChange={ ( next ) =>
								draft.change(
									'google_wait_for_update',
									Number( next )
								)
							}
							help={ __(
								'Allow a brief pause for your consent tool to provide its decision.',
								'pixelpair'
							) }
							error={
								! validWait
									? __(
											'Enter a whole number between 0 and 2000.',
											'pixelpair'
										)
									: ''
							}
						/>
						{ Object.entries( services ).map(
							( [ key, label ] ) => (
								<TextField
									key={ key }
									label={ label }
									value={ value[ key ] }
									onChange={ ( next ) =>
										draft.change( key, next )
									}
									help={ __(
										'Use the identifier configured in your consent plugin; WP Consent API takes priority.',
										'pixelpair'
									) }
									error={
										! validService( value[ key ] )
											? __(
													'Use up to 100 letters, numbers, underscores or hyphens.',
													'pixelpair'
												)
											: ''
									}
								/>
							)
						) }
						<p className="pixelpair-helper">
							{ __(
								'WordPress privacy tools can export or erase PixelPair order attribution without deleting the order.',
								'pixelpair'
							) }
						</p>
					</Section>
				</fieldset>
				<SaveBar
					dirty={ draft.dirty }
					busy={ draft.busy }
					disabled={ ! valid }
					onDiscard={ draft.discard }
				/>
			</form>
		</Page>
	);
}
