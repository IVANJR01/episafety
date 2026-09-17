import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/*
 * jsdom não implementa scrollIntoView. Sem este remendo, qualquer tela que
 * acompanha o fim de uma lista — a conversa do atendimento, por exemplo —
 * derruba o teste por uma lacuna do ambiente, não por defeito do produto.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
