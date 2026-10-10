/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import {
	Page,
	Section,
	Button,
	SaveBar,
	Feedback,
	Skeleton,
	ExternalLink,
} from '../components/ui';
import { CheckField, TextField } from '../components/ui/fields';
import { useResource } from '../data/useResource';
import { useDraft } from '../data/useDraft';
import { links } from '../links';
import ConfigurationTransfer from '../components/ConfigurationTransfer';
const keys = [
	'strict_cache_mode',
	'trust_proxy',
	'logging_enabled',
	'log_retention_days',
	'debug_enabled',
	'debug_hide_name',
	'keep_data_on_uninstall',
	'permission_roles',
];
function SettingsScreen( {
	settings,
	save,
	error,
	load,
	navigate,
	permissions,
} ) {
	const [ problem, setProblem ] = useState( '' );
	const [ transferBusy, setTransferBusy ] = useState( false );
	const write = async ( patch ) => {
		setProblem( '' );
		const { permission_roles: roles, ...preferences } = patch;
		const preferencesChanged = Object.keys( preferences ).length > 0;
		if ( preferencesChanged && ! ( await save( preferences ) ) ) {
			return false;
		}
		if ( roles ) {
			try {
				permissions.setData(
					await apiFetch( {
						path: '/pixelpair/v1/permissions',
						method: 'POST',
						data: { roles },
					} )
				);
			} catch ( failure ) {
				setProblem(
					preferencesChanged
						? __(
								'Preferences saved. Permissions were not saved. Check your access and try again.',
								'pixelpair'
							)
						: failure.message ||
								__(
									'Permissions were not saved. Check your access and try again.',
									'pixelpair'
								)
				);
				return false;
			}
		}
		return true;
	};
	const draft = useDraft(
		{ ...settings, permission_roles: permissions?.data?.roles || null },
		keys,
		write
	);
	const value = draft.values;
	const roles = value.permission_roles || permissions?.data?.roles || [];
	const valid =
		Number.isInteger( value.log_retention_days ) &&
		value.log_retention_days >= 1 &&
		value.log_retention_days <= 90;
	return (
		<Page
			title={ __( 'Settings', 'pixelpair' ) }
			description={ __(
				'Manage site preferences, access and configuration backups.',
				'pixelpair'
			) }
		>
			{ error && <Feedback error message={ error } /> }
			{ problem && <Feedback error message={ problem } /> }
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
					disabled={ draft.busy || transferBusy }
				>
					<Section title={ __( 'Activity and data', 'pixelpair' ) }>
						<CheckField
							label={ __(
								'Record server activity',
								'pixelpair'
							) }
							checked={ value.logging_enabled }
							onChange={ ( next ) =>
								draft.change( 'logging_enabled', next )
							}
							help={ __(
								'Keep redacted delivery records so you can diagnose server events.',
								'pixelpair'
							) }
						/>
						<TextField
							label={ __( 'Keep logs for (days)', 'pixelpair' ) }
							type="number"
							min="1"
							max="90"
							value={ value.log_retention_days }
							onChange={ ( next ) =>
								draft.change(
									'log_retention_days',
									Number( next )
								)
							}
							help={ __(
								'Delete older activity automatically, between 1 and 90 days.',
								'pixelpair'
							) }
							error={
								! valid
									? __(
											'Enter a whole number between 1 and 90.',
											'pixelpair'
										)
									: ''
							}
						/>
						<CheckField
							label={ __(
								'Keep data on uninstall',
								'pixelpair'
							) }
							checked={ value.keep_data_on_uninstall }
							onChange={ ( next ) =>
								draft.change( 'keep_data_on_uninstall', next )
							}
							help={ __(
								'Preserve PixelPair data when the plugin is deleted.',
								'pixelpair'
							) }
						/>
					</Section>
					<Section advanced>
						<CheckField
							label={ __( 'Strict cache mode', 'pixelpair' ) }
							checked={ value.strict_cache_mode }
							onChange={ ( next ) =>
								draft.change( 'strict_cache_mode', next )
							}
							help={ __(
								'Adds a visitor check per page; use when logged-in visitors receive shared cached pages.',
								'pixelpair'
							) }
						/>
						<p className="pixelpair-helper">
							{ __(
								'Fast mode expects logged-in cache bypass. IP exclusions always require a visitor check.',
								'pixelpair'
							) }{ ' ' }
							<ExternalLink href={ links.docs }>
								{ __( 'Learn more', 'pixelpair' ) }
							</ExternalLink>
						</p>
						<CheckField
							label={ __(
								'Trust forwarded visitor addresses',
								'pixelpair'
							) }
							checked={ value.trust_proxy }
							onChange={ ( next ) =>
								draft.change( 'trust_proxy', next )
							}
							help={ __(
								'Enable only when your trusted proxy replaces forwarded address headers.',
								'pixelpair'
							) }
						/>
						<CheckField
							label={ __(
								'Show administrator event debug console',
								'pixelpair'
							) }
							checked={ value.debug_enabled }
							onChange={ ( next ) =>
								draft.change( 'debug_enabled', next )
							}
							help={ __(
								'Show event names and IDs to authenticated administrators on your site.',
								'pixelpair'
							) }
						/>
						<CheckField
							label={ __(
								'Hide plugin name in debug output',
								'pixelpair'
							) }
							checked={ value.debug_hide_name }
							onChange={ ( next ) =>
								draft.change( 'debug_hide_name', next )
							}
							help={ __(
								'Use a neutral label for the administrator debug console.',
								'pixelpair'
							) }
						/>
					</Section>
					{ permissions && (
						<Section
							advanced
							title={ __( 'Permissions', 'pixelpair' ) }
						>
							<p className="pixelpair-helper">
								{ __(
									'Choose who can manage PixelPair. Administrator access is always retained.',
									'pixelpair'
								) }
							</p>
							{ permissions.error && (
								<Feedback
									error
									message={ permissions.error }
									action={
										<Button
											busy={ permissions.loading }
											busyLabel={ __(
												'Loading…',
												'pixelpair'
											) }
											onClick={ permissions.refresh }
										>
											{ __(
												'Retry permissions',
												'pixelpair'
											) }
										</Button>
									}
								/>
							) }
							{ permissions.loading && ! permissions.data && (
								<Skeleton />
							) }
							{ permissions.data &&
								( window.pixelpairAdmin.roles || [] ).map(
									( role ) => (
										<CheckField
											key={ role.slug }
											label={ role.name }
											disabled={
												role.slug === 'administrator' ||
												permissions.loading
											}
											checked={
												role.slug === 'administrator' ||
												roles.includes( role.slug )
											}
											onChange={ ( next ) =>
												draft.change(
													'permission_roles',
													next
														? [
																...roles,
																role.slug,
															]
														: roles.filter(
																( slug ) =>
																	slug !==
																	role.slug
															)
												)
											}
										/>
									)
								) }
						</Section>
					) }
				</fieldset>
				<SaveBar
					dirty={ draft.dirty }
					busy={ draft.busy || transferBusy }
					disabled={ ! valid }
					onDiscard={ () => {
						draft.discard();
						setProblem( '' );
					} }
				/>
			</form>
			<ConfigurationTransfer
				disabled={ draft.dirty || draft.busy }
				load={ load }
				onBusy={ setTransferBusy }
			/>
			<Section
				title={ __( 'AI access', 'pixelpair' ) }
				description={ __(
					'Connect an authenticated assistant to inspect or update your tracking configuration.',
					'pixelpair'
				) }
			>
				<Button onClick={ () => navigate( 'settings/ai' ) }>
					{ __( 'Manage AI access', 'pixelpair' ) }
				</Button>
			</Section>
			<Section title={ __( 'About', 'pixelpair' ) }>
				<p>
					{ sprintf(
						/* translators: %1$s: plugin version. */ __(
							'Version %1$s',
							'pixelpair'
						),
						window.pixelpairAdmin?.version || ''
					) }
					<br />
					{ __( 'Arif PixelPair – Marketing Tracking', 'pixelpair' ) }
					<br />
					{ __( 'Built by Arif Hasnat', 'pixelpair' ) }
				</p>
				<div className="pixelpair-actions">
					<ExternalLink href={ links.repository }>
						{ __( 'GitHub', 'pixelpair' ) }
					</ExternalLink>
					<ExternalLink href={ links.docs }>
						{ __( 'Documentation', 'pixelpair' ) }
					</ExternalLink>
				</div>
			</Section>
		</Page>
	);
}
function AuthorizedSettings( props ) {
	const permissions = useResource( '/pixelpair/v1/permissions' );
	return <SettingsScreen { ...props } permissions={ permissions } />;
}
export default function Settings( props ) {
	return window.pixelpairAdmin?.canPermissions ? (
		<AuthorizedSettings { ...props } />
	) : (
		<SettingsScreen { ...props } />
	);
}
