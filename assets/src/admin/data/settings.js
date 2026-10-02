import apiFetch from '@wordpress/api-fetch';
import { createReduxStore, register } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

export const STORE_NAME = 'pixelpair/settings';

/**
 * Create an isolated settings store with an ordered write queue.
 *
 * @param {function(Object): Promise<Object>} request Authenticated API client.
 * @return {Object} WordPress store descriptor.
 */
export function createSettingsStore( request = apiFetch ) {
	let queue = Promise.resolve();
	return createReduxStore( STORE_NAME, {
		reducer: (
			state = {
				settings: null,
				onboardingComplete: false,
				loading: false,
				saving: false,
				error: '',
			},
			action
		) =>
			action.type === 'STATE' ? { ...state, ...action.values } : state,
		actions: {
			setState: ( values ) => ( { type: 'STATE', values } ),
			clearError: () => ( { type: 'STATE', values: { error: '' } } ),
			load:
				() =>
				async ( { dispatch } ) => {
					dispatch.setState( { loading: true, error: '' } );
					try {
						const settings = await request( {
							url: window.pixelpairAdmin?.settingsUrl,
							method: 'GET',
							headers: {
								'X-WP-Nonce': window.pixelpairAdmin?.nonce,
							},
						} );
						dispatch.setState( {
							settings,
							loading: false,
							onboardingComplete: !! settings.onboarding_complete,
						} );
						return true;
					} catch ( error ) {
						dispatch.setState( {
							loading: false,
							error:
								error.message ||
								__( 'Could not load settings.', 'pixelpair' ),
						} );
						return false;
					}
				},
			save:
				( values ) =>
				( { dispatch, select } ) => {
					queue = queue.then( async () => {
						// Snapshot before optimistic state changes; catch must restore this version.

						const previous = select.getSettings();
						try {
							const patch =
								typeof values === 'function'
									? values( previous )
									: values;
							dispatch.setState( {
								settings: { ...previous, ...patch },
								saving: true,
								error: '',
							} );
							const settings = await request( {
								url: window.pixelpairAdmin?.settingsUrl,
								method: 'POST',
								headers: {
									'X-WP-Nonce': window.pixelpairAdmin?.nonce,
								},
								data: patch,
							} );
							dispatch.setState( {
								settings,
								saving: false,
								onboardingComplete:
									!! settings.onboarding_complete,
							} );
							return true;
						} catch ( error ) {
							dispatch.setState( {
								settings: previous,
								saving: false,
								error:
									error.message ||
									__(
										'Could not save settings.',
										'pixelpair'
									),
							} );
							return false;
						}
					} );
					return queue;
				},
		},
		selectors: {
			getSettings: ( state ) => state.settings,
			hasCompletedOnboarding: ( state ) => state.onboardingComplete,
			getError: ( state ) => state.error,
			isLoading: ( state ) => state.loading,
			isSaving: ( state ) => state.saving,
		},
	} );
}

export const settingsStore = createSettingsStore();
register( settingsStore );
