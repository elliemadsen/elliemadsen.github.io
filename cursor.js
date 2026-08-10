/* Custom color-inverting cursor (mouse devices only). Included on every page. */
if (window.matchMedia("(pointer: fine)").matches) {
  const cursor = document.createElement("div");
  cursor.id = "custom-cursor";
  cursor.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M0 0L0 17.5L4.5 13.7L7.5 20L10.3 18.7L7.4 12.5L13.5 12.3Z" fill="white"/></svg>';
  document.body.appendChild(cursor);

  document.addEventListener("mousemove", e => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
    cursor.style.opacity = "1";
  });

  document.addEventListener("mouseleave", () => {
    cursor.style.opacity = "0";
  });

  /* The Fullscreen API promotes the fullscreen element to the browser's top
     layer, which paints above everything else in the document — including
     this cursor if it's still parented to <body>. Move it inside whichever
     element is fullscreen so it stays visible, and back to <body> on exit. */
  document.addEventListener("fullscreenchange", () => {
    (document.fullscreenElement || document.body).appendChild(cursor);
  });
}
