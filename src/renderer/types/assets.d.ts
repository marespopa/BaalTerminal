declare module '*.css';
declare module '@xterm/xterm/css/xterm.css';
declare module '*.svg' {
	const source: string;
	export default source;
}