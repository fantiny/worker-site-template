/**
 * 「水色玻璃」主题的纯 CSS 装饰场景:
 * 漂浮的玻璃/木质几何体 + 柔光光斑,零依赖(three.js 不需要)。
 * 样式全部在 themes/aqua.css 中,按主题作用域。
 */
export default function AquaScene() {
  return (
    <div className="aqua-scene" aria-hidden>
      <i className="aqua-bokeh aq-b1" />
      <i className="aqua-bokeh aq-b2" />
      <i className="aqua-bokeh aq-b3" />
      <i className="aqua-bokeh aq-b4" />
      <i className="aq-shape aq-wood-ring" />
      <i className="aq-shape aq-glass-ring" />
      <i className="aq-shape aq-sphere-blue" />
      <i className="aq-shape aq-sphere-purple" />
      <i className="aq-shape aq-sphere-peach" />
      <i className="aq-shape aq-slab" />
    </div>
  );
}
