/**
 * Skip to Main Content Link
 * #140: Keyboard navigation accessibility feature
 *
 * This component provides a skip link for keyboard users to bypass
 * navigation and jump directly to the main content area.
 */

function SkipToMain() {
  return (
    <a
      href="#main-content"
      className="skip-to-main"
      onClick={(e) => {
        e.preventDefault();
        const main = document.getElementById('main-content');
        if (main) {
          main.focus();
          main.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }}
    >
      Skip to main content
    </a>
  );
}

export default SkipToMain;
