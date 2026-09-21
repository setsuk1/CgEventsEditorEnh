import { ExternalUrlCode } from '@shared';

const EXTERNAL_URLS: Record<ExternalUrlCode, string> = {
	[ExternalUrlCode.OLD_EDITOR_BASIC_TUTORIAL]: 'https://twmission.blogspot.com/2012/11/blog-post.html',
	[ExternalUrlCode.OLD_EDITOR_TUTORIAL_SECTION]: 'https://twmission.blogspot.com/2012/11/blog-post_4745.html',
	[ExternalUrlCode.OLD_EDITOR_DISCUSSION]: 'https://twmission.blogspot.com/2012/12/blog-post.html',
	[ExternalUrlCode.OLD_EDITOR_SAMPLE_DOWNLOAD]: 'https://twmission.blogspot.com/2012/11/blog-post_29.html',
	[ExternalUrlCode.ORIGINAL_EDITOR_BASIC_TUTORIAL]: 'https://haskasu.github.io/code.gamelet.doc/zh/intro.html',
	[ExternalUrlCode.ORIGINAL_EDITOR_TUTORIAL_SECTION]: 'https://www.youtube.com/playlist?list=PL1GxW0vJciBTV9DNrhhRpB80gl5irQRx8',
	[ExternalUrlCode.ORIGINAL_EDITOR_DISCUSSION]: 'https://code.gamelet.com/discuss',
	[ExternalUrlCode.ORIGINAL_EDITOR_SAMPLE_DOWNLOAD]: 'https://code.gamelet.com/projects',
	[ExternalUrlCode.ONLINE_EDITOR]: 'https://code.gamelet.com/edit/',
};

export function resolveExternalUrl(
	code: ExternalUrlCode,
	projectCode?: string,
): string | undefined {
	const baseUrl = EXTERNAL_URLS[code];
	if (!baseUrl) {
		return undefined;
	}
	if (code !== ExternalUrlCode.ONLINE_EDITOR) {
		return baseUrl;
	}
	return projectCode ? baseUrl + encodeURIComponent(projectCode) : undefined;
}
