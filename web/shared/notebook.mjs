export function notebookURL(id){return '/notebook/?id='+encodeURIComponent(id);}
export function openNotebook(id){
  // The click opens a tab immediately; that tab waits for the local server.
  window.open(notebookURL(id),'_blank','noopener');
}
