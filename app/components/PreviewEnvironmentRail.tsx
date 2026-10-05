/** Fixed left stripe on preview/test deployments (not navigation). */
export default function PreviewEnvironmentRail() {
  return (
    <div className="preview-env-rail" role="status" aria-label="Preview environment">
      <span className="preview-env-rail-label">Preview</span>
    </div>
  );
}
