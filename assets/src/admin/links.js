// Official help destinations verified 2026-10-02; keep external admin links here.
export const links = {
	mcpAdapter: 'https://github.com/WordPress/mcp-adapter',
	metaId: 'https://developers.facebook.com/docs/meta-pixel/get-started/',
	metaToken:
		'https://developers.facebook.com/docs/marketing-api/conversions-api/get-started/',
	ga4Id: 'https://support.google.com/analytics/answer/12270356?hl=en',
	gtmId: 'https://support.google.com/tagmanager/answer/14842164?hl=en',
	tiktokId:
		'https://ads.tiktok.com/resources/help/article/how-to-create-and-access-tiktok-pixel-id?lang=en',
	tiktokToken:
		'https://ads.tiktok.com/resources/help/article/getting-started-events-api?lang=en',
	profileHelp:
		'https://wordpress.org/documentation/article/users-your-profile-screen/',
	docs: new URL(
		'../docs/admin-guide.html',
		window.pixelpairAdmin?.logoUrl || window.location.href
	).href,
	repository: 'https://github.com/arifhasnat3po/pixelpair-plugin',
	author: 'https://github.com/arifhasnat3po',
};
