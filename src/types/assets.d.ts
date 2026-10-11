// Images imported in code resolve to an asset id (Metro).
declare module "*.png" {
  const id: number;
  export default id;
}
