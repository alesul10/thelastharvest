import { Engine } from '@babylonjs/core';
import { ForestScene } from './scenes/ForestScene';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
  antialias: true,
});

const game = new ForestScene(engine, canvas);

(async () => {
  await game.initialize();

  engine.runRenderLoop(() => {
    game.update();
  });

  window.addEventListener('resize', () => {
    engine.resize();
  });
})();
