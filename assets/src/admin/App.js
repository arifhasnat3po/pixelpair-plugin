/** @jsxRuntime classic */
/** @jsx createElement */
import {
	createElement,
	useEffect,
	useState,
	useRef,
	lazy,
	Suspense,
	Component,
} from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { STORE_NAME } from './data/settings';
import {
	Page,
	Button,
	Feedback,
	Skeleton,
	ConfirmDialog,
	EmptyState,
} from './components/ui';

const screens = {
	overview: lazy( () => import( './screens/Overview' ) ),
	setup: lazy( () => import( './screens/Dashboard' ) ),
	connections: lazy( () => import( './screens/Connections' ) ),
	events: lazy( () => import( './screens/Events' ) ),
	store: lazy( () => import( './screens/Commerce' ) ),
	scripts: lazy( () => import( './screens/Scripts' ) ),
	privacy: lazy( () => import( './screens/Privacy' ) ),
	activity: lazy( () => import( './screens/Logs' ) ),
	settings: lazy( () => import( './screens/Settings' ) ),
	ai: lazy( () => import( './screens/AI' ) ),
};
const aliases = {
	dashboard: 'overview',
	platforms: 'connections',
	commerce: 'store',
	logs: 'activity',
};
const currentRoute = () =>
	window.location.hash.replace( /^#\/?/, '' ) || 'overview';

class ScreenBoundary extends Component {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	render() {
		return this.state.failed ? (
			<Page title={ __( 'This screen could not load', 'pixelpair' ) }>
				<EmptyState
					action={
						<Button onClick={ () => window.location.reload() }>
							{ __( 'Reload screen', 'pixelpair' ) }
						</Button>
					}
				>
					{ __(
						'Reload the page to restore your connection and try again.',
						'pixelpair'
					) }
				</EmptyState>
			</Page>
		) : (
			this.props.children
		);
	}
}

export default function App() {
	const [ route, setRoute ] = useState( currentRoute );
	const routeRef = useRef( route );
	const position = useRef( window.history.state?.pixelpairPosition ?? 0 );
	const restoring = useRef( false );
	const approvedHistory = useRef( false );
	const [ pending, setPending ] = useState( '' );
	const { settings, loading, saving, error, onboardingComplete } = useSelect(
		( select ) => {
			const store = select( STORE_NAME );
			return {
				settings: store.getSettings(),
				onboardingComplete: store.hasCompletedOnboarding(),
				loading: store.isLoading(),
				saving: store.isSaving(),
				error: store.getError(),
			};
		},
		[]
	);
	const { load, save, clearError } = useDispatch( STORE_NAME );
	const hasSettings = !! settings;
	useEffect( () => {
		if ( hasSettings ) {
			clearError();
		}
	}, [ route, hasSettings, clearError ] );
	useEffect( () => {
		window.history.replaceState(
			{ ...window.history.state, pixelpairPosition: position.current },
			'',
			window.location.href
		);
		load();
	}, [ load ] );
	const commitRoute = ( next, replace = false ) => {
		if ( ! replace ) {
			position.current++;
		}
		window.history[ replace ? 'replaceState' : 'pushState' ](
			{ ...window.history.state, pixelpairPosition: position.current },
			'',
			`#/${ next }`
		);
		routeRef.current = next;
		setRoute( next );
	};
	const navigate = ( target ) => {
		const next = aliases[ target ] || target;
		if ( next === routeRef.current ) {
			return;
		}
		const event = new CustomEvent( 'pixelpair:before-route', {
			cancelable: true,
			detail: { busy: false },
		} );
		if ( ! window.dispatchEvent( event ) ) {
			if ( ! event.detail.busy ) {
				setPending( { route: next } );
			}
			return;
		}
		commitRoute( next );
	};
	useEffect( () => {
		const changed = () => {
			if ( restoring.current ) {
				restoring.current = false;
				return;
			}
			const next = currentRoute();
			const destination =
				window.history.state?.pixelpairPosition ?? position.current + 1;
			window.history.replaceState(
				{ ...window.history.state, pixelpairPosition: destination },
				'',
				window.location.href
			);
			const event = new CustomEvent( 'pixelpair:before-route', {
				cancelable: true,
				detail: { busy: false },
			} );
			if (
				next !== routeRef.current &&
				! approvedHistory.current &&
				! window.dispatchEvent( event )
			) {
				const delta = destination - position.current;
				restoring.current = true;
				window.history.go( -delta );
				if ( ! event.detail.busy ) {
					setPending( { route: next, delta } );
				}
				return;
			}
			approvedHistory.current = false;
			position.current = destination;
			routeRef.current = next;
			setRoute( next );
		};
		window.addEventListener( 'hashchange', changed );
		return () => window.removeEventListener( 'hashchange', changed );
	}, [] );
	const nav = [
		[ 'overview', __( 'Overview', 'pixelpair' ) ],
		[ 'connections', __( 'Connections', 'pixelpair' ) ],
		[ 'events', __( 'Events', 'pixelpair' ) ],
	];
	if (
		window.pixelpairAdmin?.stores?.woocommerce ||
		window.pixelpairAdmin?.stores?.edd
	) {
		nav.push( [ 'store', __( 'Store', 'pixelpair' ) ] );
	}
	if ( window.pixelpairAdmin?.canScripts ) {
		nav.push( [ 'scripts', __( 'Scripts', 'pixelpair' ) ] );
	}
	nav.push(
		[ 'privacy', __( 'Privacy', 'pixelpair' ) ],
		[ 'activity', __( 'Activity', 'pixelpair' ) ],
		[ 'settings', __( 'Settings', 'pixelpair' ) ]
	);
	let name = route.split( '/' )[ 0 ];
	if ( route === 'settings/ai' ) {
		name = 'ai';
	}
	if ( name === 'overview' && settings && ! onboardingComplete ) {
		name = 'setup';
	}
	useEffect( () => {
		const menu = document.querySelector(
			'#toplevel_page_pixelpair .wp-submenu'
		);
		if ( ! menu ) {
			return;
		}
		const links = menu.querySelectorAll( 'a' );
		links.forEach( ( link ) => {
			const target =
				new URL( link.href ).hash.replace( /^#\/?/, '' ) || 'overview';
			const active = target === route.split( '/' )[ 0 ];
			link.closest( 'li' ).classList.toggle( 'current', active );
			if ( active ) {
				link.setAttribute( 'aria-current', 'page' );
			} else {
				link.removeAttribute( 'aria-current' );
			}
		} );
		const follow = ( event ) => {
			const link = event.target.closest( 'a' );
			if (
				! link ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				event.button !== 0
			) {
				return;
			}
			event.preventDefault();
			navigate(
				new URL( link.href ).hash.replace( /^#\/?/, '' ) || 'overview'
			);
		};
		menu.addEventListener( 'click', follow );
		return () => menu.removeEventListener( 'click', follow );
	} );
	const Screen = screens[ name ];
	return (
		<div className="pixelpair-app" data-route={ route }>
			<nav
				className="pixelpair-nav"
				aria-label={ __( 'PixelPair screens', 'pixelpair' ) }
			>
				{ nav.map( ( [ id, label ] ) => (
					<a
						key={ id }
						href={ `#/${ id }` }
						aria-current={
							route.split( '/' )[ 0 ] === id ? 'page' : undefined
						}
						onClick={ ( event ) => {
							if (
								! event.ctrlKey &&
								! event.metaKey &&
								! event.shiftKey
							) {
								event.preventDefault();
								navigate( id );
							}
						} }
					>
						{ label }
					</a>
				) ) }
			</nav>
			{ ( loading || ( ! settings && ! error ) ) && ! settings && (
				<Skeleton />
			) }
			{ ! settings && error && (
				<Feedback
					error
					message={ error }
					action={
						<Button onClick={ load }>
							{ __( 'Retry', 'pixelpair' ) }
						</Button>
					}
				/>
			) }

			{ settings && (
				<ScreenBoundary key={ route }>
					<Suspense fallback={ <Skeleton /> }>
						{ Screen ? (
							<Screen
								settings={
									name === 'setup'
										? {
												...settings,
												onboarding_complete: false,
											}
										: settings
								}
								save={ save }
								saving={ saving }
								error={ error }
								load={ load }
								navigate={ navigate }
								route={ route }
							/>
						) : (
							<Page
								title={ __( 'Screen not found', 'pixelpair' ) }
							>
								<EmptyState
									action={
										<Button
											onClick={ () =>
												navigate( 'overview' )
											}
										>
											{ __(
												'Open Overview',
												'pixelpair'
											) }
										</Button>
									}
								>
									{ __(
										'Choose a screen from the navigation to continue.',
										'pixelpair'
									) }
								</EmptyState>
							</Page>
						) }
					</Suspense>
				</ScreenBoundary>
			) }
			{ pending && (
				<ConfirmDialog
					destructive={ false }
					title={ __( 'Discard unsaved changes?', 'pixelpair' ) }
					confirmLabel={ __( 'Discard changes', 'pixelpair' ) }
					onCancel={ () => setPending( '' ) }
					onConfirm={ () => {
						if ( pending.delta ) {
							approvedHistory.current = true;
							window.history.go( pending.delta );
						} else {
							commitRoute( pending.route );
						}
						setPending( '' );
					} }
				>
					{ __(
						'Your changes on this screen have not been saved.',
						'pixelpair'
					) }
				</ConfirmDialog>
			) }
		</div>
	);
}
