/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
	Page,
	Section,
	Button,
	Feedback,
	Skeleton,
	StatusBadge,
	ExternalLink,
} from '../components/ui';
import { TextField } from '../components/ui/fields';
import { useResource } from '../data/useResource';
import { links } from '../links';
export default function AI( { navigate } ) {
	const resource = useResource( '/pixelpair/v1/ai-status' );
	const [ copying, setCopying ] = useState( false );
	const [ copied, setCopied ] = useState( false );
	const [ problem, setProblem ] = useState( '' );
	const status = resource.data;
	const available = status?.abilities && status?.adapter;
	const copy = async () => {
		setCopying( true );
		setCopied( false );
		setProblem( '' );
		try {
			if ( ! navigator.clipboard?.writeText ) {
				throw new Error();
			}
			await navigator.clipboard.writeText(
				[
					sprintf(
						/* translators: %1$s: endpoint. */ __(
							'Endpoint: %1$s',
							'pixelpair'
						),
						status.endpoint
					),
					sprintf(
						/* translators: %1$d: site ID. */ __(
							'Site ID: %1$d',
							'pixelpair'
						),
						status.site_id
					),
				].join( '\n' )
			);
			setCopied( true );
		} catch {
			setProblem(
				__(
					'Copy was blocked. Select and copy the endpoint and site ID below.',
					'pixelpair'
				)
			);
		} finally {
			setCopying( false );
		}
	};
	return (
		<Page
			title={ __( 'AI access', 'pixelpair' ) }
			description={ __(
				'Connect an assistant through authenticated MCP access.',
				'pixelpair'
			) }
			back={
				<Button
					variant="tertiary"
					onClick={ () => navigate( 'settings' ) }
				>
					{ __( 'Back to Settings', 'pixelpair' ) }
				</Button>
			}
			status={
				status && (
					<StatusBadge status={ available ? 'info' : 'warning' }>
						{ available
							? __( 'AI connection available', 'pixelpair' )
							: __( 'Setup needed', 'pixelpair' ) }
					</StatusBadge>
				)
			}
		>
			{ resource.error && (
				<Feedback
					error
					message={ resource.error }
					action={
						<Button
							busy={ resource.loading }
							busyLabel={ __( 'Loading…', 'pixelpair' ) }
							onClick={ resource.refresh }
						>
							{ __( 'Retry', 'pixelpair' ) }
						</Button>
					}
				/>
			) }
			{ resource.loading && ! status && <Skeleton /> }
			{ status && (
				<div>
					{ ! status.abilities && (
						<Feedback
							status="warning"
							message={ __(
								'Update to WordPress 6.9 or later to enable AI access.',
								'pixelpair'
							) }
						/>
					) }
					{ ! status.adapter && (
						<Feedback
							status="warning"
							message={ __(
								'Install and activate the official WordPress MCP Adapter. Tested with version 0.6.1.',
								'pixelpair'
							) }
							action={
								<ExternalLink href={ links.mcpAdapter }>
									{ __( 'Learn more', 'pixelpair' ) }
								</ExternalLink>
							}
						/>
					) }
					{ ! status.https && (
						<Feedback
							status="warning"
							message={ __(
								'Use HTTPS before sending an Application Password on a live site. HTTP is for isolated testing.',
								'pixelpair'
							) }
						/>
					) }
					<Section title={ __( 'Connection details', 'pixelpair' ) }>
						{ copied && (
							<Feedback
								message={ __(
									'Connection details copied',
									'pixelpair'
								) }
							/>
						) }
						{ problem && <Feedback error message={ problem } /> }
						<TextField
							label={ __( 'MCP endpoint', 'pixelpair' ) }
							value={ status.endpoint }
							readOnly
							help={ __(
								'Use HTTP transport with Basic authentication, directly or through a compatible local proxy.',
								'pixelpair'
							) }
						/>
						<TextField
							label={ __( 'Site ID', 'pixelpair' ) }
							value={ String( status.site_id ) }
							readOnly
							help={ __(
								'Include this site ID with every tool call.',
								'pixelpair'
							) }
						/>
						<Button
							disabled={ ! available }
							busy={ copying }
							busyLabel={ __( 'Copying…', 'pixelpair' ) }
							onClick={ copy }
						>
							{ __( 'Copy connection details', 'pixelpair' ) }
						</Button>
					</Section>
					<Section
						title={ __( 'Authorize your assistant', 'pixelpair' ) }
						description={ __(
							'Use a dedicated WordPress account with permission to manage PixelPair.',
							'pixelpair'
						) }
					>
						<p className="pixelpair-helper">
							{ __(
								'Create an Application Password in that account’s profile; enter it only in your MCP client.',
								'pixelpair'
							) }{ ' ' }
							<ExternalLink href={ links.profileHelp }>
								{ __( 'Learn more', 'pixelpair' ) }
							</ExternalLink>
						</p>
						<Button variant="primary" href={ status.profile_url }>
							{ __( 'Open Application Passwords', 'pixelpair' ) }
						</Button>
						<p className="pixelpair-helper">
							{ __(
								'Revoke the Application Password to disconnect the assistant.',
								'pixelpair'
							) }
						</p>
					</Section>
					<Section advanced>
						<p>
							{ __(
								'Assistants can inspect settings, events and the last 50 redacted logs.',
								'pixelpair'
							) }
						</p>
						<p>
							{ __(
								'They can update validated settings and create, edit, toggle, duplicate or delete events.',
								'pixelpair'
							) }
						</p>
						<p>
							{ __(
								'Tokens, executable scripts, permission grants and transport URL changes are unavailable through AI access.',
								'pixelpair'
							) }
						</p>
						<p>
							{ __(
								'Changes affect live tracking. Review proposed edits in your AI client; deletion requires confirmation.',
								'pixelpair'
							) }
						</p>
					</Section>
				</div>
			) }
		</Page>
	);
}
