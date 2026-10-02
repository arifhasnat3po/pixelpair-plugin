/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, lazy } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Page, Button, Skeleton, Feedback } from '../components/ui';
import ConnectionList from '../components/ConnectionList';
import { useResource } from '../data/useResource';
import { configuredPlatforms } from '../data/connections';

const Meta = lazy( () => import( './Meta' ) );
const GoogleAnalytics = lazy( () => import( './GoogleAnalytics' ) );
const TagManager = lazy( () => import( './TagManager' ) );
const TikTok = lazy( () => import( './TikTok' ) );

function List( { settings, navigate } ) {
	const resource = useResource( '/pixelpair/v1/dashboard' );
	return (
		<Page
			title={ __( 'Connections', 'pixelpair' ) }
			description={ __(
				'Connect the platforms you use to measure visits and sales.',
				'pixelpair'
			) }
		>
			{ resource.error && (
				<Feedback
					error
					message={ resource.error }
					action={
						<Button onClick={ resource.refresh }>
							{ __( 'Retry', 'pixelpair' ) }
						</Button>
					}
				/>
			) }
			{ ! resource.data && resource.loading && <Skeleton /> }
			{ resource.data && (
				<div className="pixelpair-page-end">
					<ConnectionList
						platforms={ configuredPlatforms(
							resource.data.platforms,
							settings
						) }
						navigate={ navigate }
					/>
				</div>
			) }
		</Page>
	);
}

export default function Connections( props ) {
	if ( props.route === 'connections/meta' ) {
		return <Meta { ...props } />;
	}
	if ( props.route === 'connections/ga4' ) {
		return <GoogleAnalytics { ...props } />;
	}
	if ( props.route === 'connections/gtm' ) {
		return <TagManager { ...props } />;
	}
	if ( props.route === 'connections/tiktok' ) {
		return <TikTok { ...props } />;
	}
	return <List { ...props } />;
}
