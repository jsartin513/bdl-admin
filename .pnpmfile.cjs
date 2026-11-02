function readPackage(pkg) {
  if (pkg.name === 'next' && pkg.dependencies?.postcss) {
    pkg.dependencies.postcss = '8.5.29';
  }
  if (pkg.name === '@esbuild-kit/core-utils' && pkg.dependencies?.esbuild) {
    pkg.dependencies.esbuild = '0.25.12';
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
