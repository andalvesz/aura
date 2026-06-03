/** Reseta um formulário sem erro se o alvo for null ou o nó foi desmontado. */
export function resetHtmlForm(form: EventTarget | null | undefined): void {
  if (form instanceof HTMLFormElement) {
    form.reset();
  }
}
