declare module 'tree-kill' {
  function treeKill(pid: number, signal?: string, callback?: (error?: Error) => void): void;
  export default treeKill;
}