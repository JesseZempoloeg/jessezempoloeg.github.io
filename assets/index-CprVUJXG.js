const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/astrodrift-CGskTZiA.js","assets/three.module-a5-T9_Em.js","assets/voidrunner-Bp8WTm3p.js","assets/planet-Bhjz0nwj.js","assets/racer-C7gINntI.js","assets/orbittac-CpqSAKv0.js","assets/neonstack-pztwXl74.js","assets/cubehop-zYcu-70v.js","assets/pong3d-Cuqqbnf8.js","assets/lightcycles-BQJ90TAu.js"])))=>i.map(i=>d[i]);
import{B as e,C as t,D as n,E as r,F as i,I as a,K as o,M as s,N as c,P as l,S as u,U as d,V as f,X as p,Y as m,Z as h,_ as g,a as ee,at as _,b as te,c as v,ct as y,f as ne,g as re,i as ie,it as ae,j as b,l as oe,m as se,n as ce,nt as le,o as ue,ot as x,q as de,r as S,rt as fe,st as C,t as pe,u as me,v as he,x as ge,z as _e}from"./three.module-a5-T9_Em.js";(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var w={name:`CopyShader`,uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`},T=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},ve=new i(-1,1,1,-1,0,1),ye=new class extends ee{constructor(){super(),this.setAttribute(`position`,new g([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new g([0,2,0,0,2,0],2))}},E=class{constructor(e){this._mesh=new b(ye,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,ve)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},be=class extends T{constructor(e,t=`tDiffuse`){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof p?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=_.clone(e.uniforms),this.material=new p({name:e.name===void 0?`unspecified`:e.name,defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new E(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},xe=class extends T{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let r=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),i.buffers.stencil.setFunc(r.ALWAYS,a,4294967295),i.buffers.stencil.setClear(o),i.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(r.EQUAL,1,4294967295),i.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),i.buffers.stencil.setLocked(!0)}},Se=class extends T{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}},D=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new x);this._width=n.width,this._height=n.height,t=new y(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:u}),t.texture.name=`EffectComposer.rt1`}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name=`EffectComposer.rt2`,this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new be(w),this.copyPass.material.blending=0,this.timer=new le}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let t=0,r=this.passes.length;t<r;t++){let r=this.passes[t];if(r.enabled!==!1){if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),r.needsSwap){if(n){let t=this.renderer.getContext(),n=this.renderer.state.buffers.stencil;n.setFunc(t.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),n.setFunc(t.EQUAL,1,4294967295)}this.swapBuffers()}xe!==void 0&&(r instanceof xe?n=!0:r instanceof Se&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new x);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(n,r),this.renderTarget2.setSize(n,r);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(n,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}},O=class extends T{constructor(e,t,n=null,r=null,i=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=r,this.clearAlpha=i,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new v}render(e,t,n){let r=e.autoClear;e.autoClear=!1;let i,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==1&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(i),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=r}},Ce={name:`LuminosityHighPassShader`,uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new v(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`},k=class e extends T{constructor(e,t=1,n,r){super(),this.strength=t,this.radius=n,this.threshold=r,this.resolution=e===void 0?new x(256,256):new x(e.x,e.y),this.clearColor=new v(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new y(i,a,{type:u,depthBuffer:!1}),this.renderTargetBright.texture.name=`UnrealBloomPass.bright`,this.renderTargetBright.texture.generateMipmaps=!1;for(let e=0;e<this.nMips;e++){let t=new y(i,a,{type:u,depthBuffer:!1});t.texture.name=`UnrealBloomPass.h`+e,t.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(t);let n=new y(i,a,{type:u,depthBuffer:!1});n.texture.name=`UnrealBloomPass.v`+e,n.texture.generateMipmaps=!1,this.renderTargetsVertical.push(n),i=Math.round(i/2),a=Math.round(a/2)}let o=Ce;this.highPassUniforms=_.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new p({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let c=[6,10,14,18,22];i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let e=0;e<this.nMips;e++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(c[e])),this.separableBlurMaterials[e].uniforms.invSize.value=new x(1/i,1/a),i=Math.round(i/2),a=Math.round(a/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let l=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=l,this.bloomTintColors=[new C(1,1,1),new C(1,1,1),new C(1,1,1),new C(1,1,1),new C(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=_.clone(w.uniforms),this.blendMaterial=new p({uniforms:this.copyUniforms,vertexShader:w.vertexShader,fragmentShader:w.fragmentShader,premultipliedAlpha:!0,blending:2,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new v,this._oldClearAlpha=1,this._basic=new s,this._fsQuad=new E(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(n,r);for(let e=0;e<this.nMips;e++)this.renderTargetsHorizontal[e].setSize(n,r),this.renderTargetsVertical[e].setSize(n,r),this.separableBlurMaterials[e].uniforms.invSize.value=new x(1/n,1/r),n=Math.round(n/2),r=Math.round(r/2)}render(t,n,r,i,a){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();let o=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),a&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let s=this.renderTargetBright;for(let n=0;n<this.nMips;n++)this._fsQuad.material=this.separableBlurMaterials[n],this.separableBlurMaterials[n].uniforms.colorTexture.value=s.texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[n]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[n].uniforms.colorTexture.value=this.renderTargetsHorizontal[n].texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[n]),t.clear(),this._fsQuad.render(t),s=this.renderTargetsVertical[n];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(r),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=o}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let r=0;r<e;r++)t.push(.39894*Math.exp(-.5*r*r/(n*n))/n);let r=[],i=[];for(let n=1;n<e;n+=2){let a=t[n],o=n+1<e?t[n+1]:0,s=a+o;r.push((n*a+(n+1)*o)/s),i.push(s)}return new p({defines:{KERNEL_PAIRS:r.length},uniforms:{colorTexture:{value:null},invSize:{value:new x(.5,.5)},direction:{value:new x(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:r},gaussianWeights:{value:i}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new p({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};k.BlurDirectionX=new x(1,0),k.BlurDirectionY=new x(0,1);var A={name:`OutputShader`,uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`},we=class extends T{constructor(){super(),this.isOutputPass=!0,this.uniforms=_.clone(A.uniforms),this.material=new d({name:A.name,uniforms:this.uniforms,vertexShader:A.vertexShader,fragmentShader:A.fragmentShader}),this._fsQuad=new E(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},oe.getTransfer(this._outputColorSpace)===`srgb`&&(this.material.defines.SRGB_TRANSFER=``),this._toneMapping===1?this.material.defines.LINEAR_TONE_MAPPING=``:this._toneMapping===2?this.material.defines.REINHARD_TONE_MAPPING=``:this._toneMapping===3?this.material.defines.CINEON_TONE_MAPPING=``:this._toneMapping===4?this.material.defines.ACES_FILMIC_TONE_MAPPING=``:this._toneMapping===6?this.material.defines.AGX_TONE_MAPPING=``:this._toneMapping===7?this.material.defines.NEUTRAL_TONE_MAPPING=``:this._toneMapping===5&&(this.material.defines.CUSTOM_TONE_MAPPING=``),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},j=new C;function M(e,t,n,r,i,a){let o=2*Math.PI*i/4,s=Math.max(a-2*i,0),c=Math.PI/4;j.copy(t),j[r]=0,j.normalize();let l=.5*o/(o+s),u=1-j.angleTo(e)/c;return Math.sign(j[n])===1?u*l:s/(o+s)+l+l*(1-u)}var Te=class e extends S{constructor(e=1,t=1,n=1,r=2,i=.1){let a=r*2+1;if(i=Math.min(e/2,t/2,n/2,i),super(1,1,1,a,a,a),this.type=`RoundedBoxGeometry`,this.parameters={width:e,height:t,depth:n,segments:r,radius:i},a===1)return;let o=this.toNonIndexed();this.index=null,this.attributes.position=o.attributes.position,this.attributes.normal=o.attributes.normal,this.attributes.uv=o.attributes.uv;let s=new C,c=new C,l=new C(e,t,n).divideScalar(2).subScalar(i),u=this.attributes.position.array,d=this.attributes.normal.array,f=this.attributes.uv.array,p=u.length/6,m=new C,h=.5/a;for(let r=0,a=0;r<u.length;r+=3,a+=2)switch(s.fromArray(u,r),c.copy(s),c.x-=Math.sign(c.x)*h,c.y-=Math.sign(c.y)*h,c.z-=Math.sign(c.z)*h,c.normalize(),u[r+0]=l.x*Math.sign(s.x)+c.x*i,u[r+1]=l.y*Math.sign(s.y)+c.y*i,u[r+2]=l.z*Math.sign(s.z)+c.z*i,d[r+0]=c.x,d[r+1]=c.y,d[r+2]=c.z,Math.floor(r/p)){case 0:m.set(1,0,0),f[a+0]=M(m,c,`z`,`y`,i,n),f[a+1]=1-M(m,c,`y`,`z`,i,t);break;case 1:m.set(-1,0,0),f[a+0]=1-M(m,c,`z`,`y`,i,n),f[a+1]=1-M(m,c,`y`,`z`,i,t);break;case 2:m.set(0,1,0),f[a+0]=1-M(m,c,`x`,`z`,i,e),f[a+1]=M(m,c,`z`,`x`,i,n);break;case 3:m.set(0,-1,0),f[a+0]=1-M(m,c,`x`,`z`,i,e),f[a+1]=1-M(m,c,`z`,`x`,i,n);break;case 4:m.set(0,0,1),f[a+0]=1-M(m,c,`x`,`y`,i,e),f[a+1]=1-M(m,c,`y`,`x`,i,t);break;case 5:m.set(0,0,-1),f[a+0]=M(m,c,`x`,`y`,i,e),f[a+1]=1-M(m,c,`y`,`x`,i,t)}}static fromJSON(t){return new e(t.width,t.height,t.depth,t.segments,t.radius)}},Ee=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,N=[16727450,4062463,16769357,8257370,10185727,16742973,5082623,16731501];function De(){let e=document.createElement(`canvas`);e.width=e.height=128;let t=e.getContext(`2d`),n=t.createRadialGradient(64,64,0,64,64,64);n.addColorStop(0,`rgba(255,255,255,1)`),n.addColorStop(.3,`rgba(255,255,255,0.5)`),n.addColorStop(1,`rgba(255,255,255,0)`),t.fillStyle=n,t.fillRect(0,0,128,128);let r=new ue(e);return r.colorSpace=de,r}var Oe=[()=>new fe(.28,.1,16,40),()=>new l(.36),()=>new me(.3,.6,4),()=>new ae(.22,.07,90,12),()=>new se(.33),()=>new S(.42,.42,.42),()=>new ne(.1,.3,.6,6),()=>new t(.36,0)],ke=class{constructor(e){this.canvas=e,this.pointer={x:0,y:0},this.target={x:0,y:0},this.bursts=[],this.running=!1,this.ok=this.init(),this.ok&&(this.resize(),this.bind(),this.start())}init(){try{this.renderer=new pe({canvas:this.canvas,antialias:!0,powerPreference:`high-performance`})}catch(e){return console.warn(`WebGL niet beschikbaar — statische achtergrond gebruikt.`,e),!1}this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),this.renderer.outputColorSpace=de,this.renderer.toneMapping=4,this.renderer.toneMappingExposure=1.15,this.scene=new m,this.scene.background=new v(328207),this.scene.fog=new he(328207,24,72),this.camera=new a(50,1,.1,200),this.camera.position.set(0,2.2,17),this.scene.add(new ce(8023295,.4)),this.coreLight=new _e(4062463,80,40,2),this.coreLight.position.set(0,1.2,4),this.scene.add(this.coreLight);let e=new _e(16727450,60,40,2);return e.position.set(-9,4,6),this.scene.add(e),this.glow=De(),this.buildGrid(),this.buildCore(),this.buildRings(),this.buildTiles(),this.buildParticles(),this.composer=new D(this.renderer),this.composer.addPass(new O(this.scene,this.camera)),this.composer.addPass(new k(new x(1,1),.85,.55,.18)),this.composer.addPass(new we),!0}buildGrid(){this.grid=new te(160,64,4062463,8006614),this.grid.material.transparent=!0,this.grid.material.opacity=.34,this.grid.material.depthWrite=!1,this.grid.position.y=-5.4,this.scene.add(this.grid)}buildCore(){this.core=new ge,this.core.position.set(0,1.2,0),this.coreBody=new b(new t(2.4,5),new c({color:1312819,metalness:.85,roughness:.25,emissive:3805038,emissiveIntensity:.7,flatShading:!0})),this.coreWire=new b(new t(2.6,2),new s({color:4062463,wireframe:!0,transparent:!0,opacity:.32})),this.shellMat=new p({transparent:!0,depthWrite:!1,blending:2,uniforms:{uTime:{value:0},uA:{value:new v(4062463)},uB:{value:new v(16727450)}},vertexShader:`
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,fragmentShader:`
        uniform float uTime;
        uniform vec3 uA;
        uniform vec3 uB;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          float pulse = 0.5 + 0.5 * sin(uTime * 2.0 + vN.y * 6.0);
          vec3 col = mix(uA, uB, pulse);
          gl_FragColor = vec4(col, fres * 0.95);
        }
      `}),this.coreShell=new b(new h(3.1,64,48),this.shellMat),this.core.add(this.coreBody,this.coreWire,this.coreShell),this.scene.add(this.core)}buildRings(){this.rings=[],[{r:4.4,tilt:1.2,roll:.3,color:4062463,speed:.35},{r:5.8,tilt:.5,roll:1.4,color:16727450,speed:-.25},{r:7.2,tilt:1.45,roll:-.7,color:16769357,speed:.18}].forEach(({r:e,tilt:t,roll:n,color:r,speed:i})=>{let a=new b(new fe(e,.03,8,260),new s({color:r,transparent:!0,opacity:.9}));a.rotation.set(t,0,n),a.userData.speed=i,this.core.add(a),this.rings.push(a)})}buildTiles(){this.tiles=N.map((e,t)=>{let i=new ge,a=new b(new Te(1.25,1.25,.22,4,.12),new c({color:788246,metalness:.6,roughness:.35})),o=new n(new re(new S(1.25,1.25,.22)),new r({color:e,transparent:!0,opacity:.95})),s=new b(Oe[t](),new c({color:e,emissive:e,emissiveIntensity:1.6,metalness:.2,roughness:.3}));return s.position.z=.22,i.add(a,o,s),this.scene.add(i),{group:i,emblem:s,angle:t/N.length*Math.PI*2,phase:t*.8,spin:.6+t%3*.3}})}buildParticles(){let t=2600,n=new Float32Array(t*3),r=new Float32Array(t*3),i=new v;for(let e=0;e<t;e++){let t=Math.random()*Math.PI*2,a=Math.acos(2*Math.random()-1),o=14+Math.random()*38;n[e*3]=o*Math.sin(a)*Math.cos(t),n[e*3+1]=o*Math.cos(a)*.6,n[e*3+2]=o*Math.sin(a)*Math.sin(t),i.setHex(N[Math.random()*N.length|0]);let s=.55+Math.random()*.45;r[e*3]=i.r*s,r[e*3+1]=i.g*s,r[e*3+2]=i.b*s}let a=new ee;a.setAttribute(`position`,new ie(n,3)),a.setAttribute(`color`,new ie(r,3));let o=new f({size:.2,map:this.glow,vertexColors:!0,transparent:!0,depthWrite:!1,blending:2,sizeAttenuation:!0});this.particles=new e(a,o),this.scene.add(this.particles)}burst(){if(!this.ok||Ee)return;let e=new b(new o(.9,1,96),new s({color:N[Math.random()*N.length|0],transparent:!0,opacity:1,side:2,depthWrite:!1,blending:2}));e.position.copy(this.core.position),this.scene.add(e),this.bursts.push({mesh:e,life:0})}bind(){this.onPointer=e=>{this.target.x=e.clientX/window.innerWidth*2-1,this.target.y=e.clientY/window.innerHeight*2-1},window.addEventListener(`pointermove`,this.onPointer,{passive:!0}),this.onDown=()=>this.burst(),window.addEventListener(`pointerdown`,this.onDown,{passive:!0}),this.onResize=()=>this.resize(),window.addEventListener(`resize`,this.onResize),this.onVisibility=()=>{document.hidden?this.stop():this.start()},document.addEventListener(`visibilitychange`,this.onVisibility)}resize(){if(!this.renderer)return;let e=document.documentElement.clientWidth||window.innerWidth,t=window.innerHeight;this.renderer.setSize(e,t,!1),this.composer.setSize(e,t),this.camera.aspect=e/t;let n=Math.min(1,e/1100);this.camera.position.z=17+(1-n)*8,this.camera.updateProjectionMatrix()}start(){if(!this.ok||this.running)return;this.running=!0,this.last=performance.now();let e=t=>{if(!this.running)return;let n=Math.min(.05,(t-this.last)/1e3);this.last=t,this.frame(n),this.raf=requestAnimationFrame(e)};this.raf=requestAnimationFrame(e)}stop(){this.running=!1,cancelAnimationFrame(this.raf)}frame(e){let t=performance.now()*.001,n=+!Ee;this.pointer.x+=(this.target.x-this.pointer.x)*.05,this.pointer.y+=(this.target.y-this.pointer.y)*.05,this.camera.position.x=this.pointer.x*2.4,this.camera.position.y=2.2-this.pointer.y*1.2,this.camera.lookAt(0,.6,0);let r=1+Math.sin(t*2)*.035*n;this.coreBody.rotation.y+=e*.15*n,this.coreWire.rotation.y-=e*.12*n,this.coreWire.rotation.x+=e*.05*n,this.coreBody.scale.setScalar(r),this.coreWire.scale.setScalar(r),this.shellMat.uniforms.uTime.value=t,this.coreLight.intensity=70+Math.sin(t*2)*25;for(let t of this.rings)t.rotation.z+=e*t.userData.speed*n;for(let r of this.tiles){let i=r.angle+t*.08*n;r.group.position.set(Math.cos(i)*8.6,1.2+Math.sin(i*2+r.phase)*.9,Math.sin(i)*3.4-1),r.group.rotation.y=-Math.sin(i)*.55,r.group.rotation.z=Math.sin(t*.7+r.phase)*.06,r.emblem.rotation.x+=e*r.spin*n,r.emblem.rotation.y+=e*r.spin*1.3*n}this.grid.position.z=t*2.2*n%2.5,this.particles.rotation.y=t*.015*n;for(let t=this.bursts.length-1;t>=0;t--){let n=this.bursts[t];n.life+=e;let r=1+n.life*14;n.mesh.scale.set(r,r,r),n.mesh.material.opacity=Math.max(0,1-n.life*1.3),n.life>.8&&(this.scene.remove(n.mesh),n.mesh.geometry.dispose(),n.mesh.material.dispose(),this.bursts.splice(t,1))}this.composer.render()}},P=new class{constructor(){this.ctx=null,this.enabled=localStorage.getItem(`astra:sound`)!==`off`}ensure(){if(!this.enabled)return null;if(!this.ctx){let e=window.AudioContext||window.webkitAudioContext;if(!e)return null;this.ctx=new e}return this.ctx.state===`suspended`&&this.ctx.resume(),this.ctx}setEnabled(e){this.enabled=e,localStorage.setItem(`astra:sound`,e?`on`:`off`),!e&&this.ctx&&this.ctx.suspend()}tone({freq:e=440,to:t=null,dur:n=.12,type:r=`sine`,gain:i=.05,delay:a=0}={}){let o=this.ensure();if(!o)return;let s=o.currentTime+a,c=o.createOscillator(),l=o.createGain();c.type=r,c.frequency.setValueAtTime(e,s),t!==null&&c.frequency.exponentialRampToValueAtTime(Math.max(40,t),s+n),l.gain.setValueAtTime(1e-4,s),l.gain.exponentialRampToValueAtTime(i,s+.012),l.gain.exponentialRampToValueAtTime(1e-4,s+n),c.connect(l).connect(o.destination),c.start(s),c.stop(s+n+.03)}noise({dur:e=.18,gain:t=.04,filter:n=900}={}){let r=this.ensure();if(!r)return;let i=Math.floor(r.sampleRate*e),a=r.createBuffer(1,i,r.sampleRate),o=a.getChannelData(0);for(let e=0;e<i;e++)o[e]=(Math.random()*2-1)*(1-e/i);let s=r.createBufferSource();s.buffer=a;let c=r.createBiquadFilter();c.type=`lowpass`,c.frequency.value=n;let l=r.createGain();l.gain.value=t,s.connect(c).connect(l).connect(r.destination),s.start()}blip(){this.tone({freq:520,to:780,dur:.09,type:`triangle`,gain:.04})}step(){this.tone({freq:240,dur:.045,type:`square`,gain:.014})}eat(){this.tone({freq:620,to:980,dur:.1,type:`triangle`,gain:.05}),this.tone({freq:1240,dur:.07,type:`sine`,gain:.025,delay:.05})}score(){this.tone({freq:700,to:1180,dur:.16,type:`sine`,gain:.05}),this.tone({freq:1050,to:1600,dur:.13,type:`sine`,gain:.028,delay:.06})}hit(){this.noise({dur:.2,gain:.09,filter:700}),this.tone({freq:130,to:60,dur:.26,type:`sawtooth`,gain:.05})}miss(){this.tone({freq:260,to:120,dur:.3,type:`sine`,gain:.045})}win(){[523,659,784,1046].forEach((e,t)=>this.tone({freq:e,dur:.3,type:`sine`,gain:.045,delay:t*.11}))}},Ae=(e,t,n)=>Math.min(n,Math.max(t,e)),je=(e,t,n)=>e+(t-e)*n,Me=(e,t)=>e+Math.random()*(t-e),Ne=e=>e[Math.floor(Math.random()*e.length)];function F(e,t,n){let r=document.createElement(e);return t&&(r.className=t),n!=null&&(r.innerHTML=n),r}function I(e){let t=localStorage.getItem(`astra:best:${e}`);return t===null?null:Number(t)}function Pe(e,t){localStorage.setItem(`astra:best:${e}`,String(t))}function L(e){return e.toLocaleString(`nl-NL`)}function Fe(e){let t=Math.floor(e/60),n=Math.floor(e%60);return`${t}:${String(n).padStart(2,`0`)}`}function R(e){return`${Math.floor(e/60)}:${(e%60).toFixed(2).padStart(5,`0`)}`}function Ie(e,t){let n=F(`div`,`game-overlay`);n.innerHTML=`
    <div class="ov-card">
      ${t.kicker?`<p class="ov-kicker">${t.kicker}</p>`:``}
      <h3>${t.title}</h3>
      ${t.text?`<p class="ov-text">${t.text}</p>`:``}
      ${t.extra||``}
      <button class="btn btn-solid" type="button">${t.button||`SPELEN`}</button>
    </div>`;let r=n.querySelector(`button`),i=()=>{n.isConnected&&(n.remove(),t.onClose?.())};return r.addEventListener(`click`,()=>{i(),t.onStart?.()}),e.appendChild(n),requestAnimationFrame(()=>r.focus({preventScroll:!0})),{node:n,close:i}}function Le(e){let t=F(`canvas`);e.appendChild(t);let n=t.getContext(`2d`),r={width:0,height:0,dpr:1},i=()=>{let i=e.getBoundingClientRect(),a=Math.min(window.devicePixelRatio||1,2);r.width=Math.max(1,Math.round(i.width)),r.height=Math.max(1,Math.round(i.height)),r.dpr=a,t.width=Math.round(r.width*a),t.height=Math.round(r.height*a),t.style.width=`${r.width}px`,t.style.height=`${r.height}px`,n.setTransform(a,0,0,a,0,0)},a=new ResizeObserver(i);return a.observe(e),i(),{canvas:t,ctx:n,state:r,resize:i,destroy:()=>a.disconnect()}}function Re(e){let t=!0,n=performance.now(),r=0,i=a=>{if(!t)return;let o=Math.min(.05,(a-n)/1e3);n=a,e(o),r=requestAnimationFrame(i)};return r=requestAnimationFrame(i),()=>{t=!1,cancelAnimationFrame(r)}}function ze(e,t){let n=e.getBoundingClientRect();return{x:t.clientX-n.left,y:t.clientY-n.top}}var Be=`modulepreload`,Ve=function(e){return`/`+e},He={},Ue=function(e){return e.pathname.endsWith(`.css`)},We=function(e,t,n){if(t in e)return e[t];let r=n();if(!r){e[t]=void 0;return}let i=r.then(()=>{e[t]=void 0},n=>{throw e[t]=void 0,n});return e[t]=i,i},z=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e,i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?new URL(import.meta.resolve(e)):new URL(e,import.meta.url)}r=o(t.map(t=>{t=Ve(t,n);let r=s(t),i=Ue(r);return We(He,r.href,()=>{if(e===void 0){e={all:new Set,styles:new Set};let t=document.getElementsByTagName(`link`);for(let n=t.length-1;n>=0;n--){let r=t[n];e.all.add(r.href),r.rel===`stylesheet`&&e.styles.add(r.href)}}if((i?e.styles:e.all).has(r.href))return;let t=document.createElement(`link`);if(t.rel=i?`stylesheet`:Be,i||(t.as=`script`),t.crossOrigin=``,t.href=r.href,a&&t.setAttribute(`nonce`,a),document.head.appendChild(t),i)return new Promise((e,n)=>{t.addEventListener(`load`,e),t.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${r}`)))})})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},B=[{id:`astrodrift`,title:`Astro Drift`,kicker:`3D · RUIMTE`,tagline:`Vlieg door de ringen, ontwijk de brokken en houd je snelheid vast.`,tint:`#8fd8ff`,glyph:`◈`,load:()=>z(()=>import(`./astrodrift-CGskTZiA.js`),__vite__mapDeps([0,1]))},{id:`voidrunner`,title:`Void Runner`,kicker:`3D · TUNNEL`,tagline:`Duik door de neon-tunnel en glip tussen de blokken door. Hoe verder, hoe sneller.`,tint:`#9b6bff`,glyph:`⟁`,bestPrefix:`BESTE`,bestSuffix:`M`,load:()=>z(()=>import(`./voidrunner-Bp8WTm3p.js`),__vite__mapDeps([2,1]))},{id:`planet`,title:`Planet Defender`,kicker:`3D · VERDEDIGEN`,tagline:`Meteorieten razen op je planeet af. Richt en vuur voordat ze inslaan.`,tint:`#3dfcff`,glyph:`◎`,load:()=>z(()=>import(`./planet-Bhjz0nwj.js`),__vite__mapDeps([3,1]))},{id:`racer`,title:`Turbo Loop`,kicker:`3D · RACE`,tagline:`Scheur over een neon-circuit vol bochten en haal de snelste ronde.`,tint:`#ff7ab6`,glyph:`▲`,bestPrefix:`BESTE`,formatBest:e=>R(e/100),load:()=>z(()=>import(`./racer-C7gINntI.js`),__vite__mapDeps([4,1]))},{id:`orbittac`,title:`Orbit Tac`,kicker:`3D · STRATEGIE`,tagline:`Boter, kaas en eieren op een zwevend bord. Draai om je zet te kiezen.`,tint:`#8fa8ff`,glyph:`✕`,bestPrefix:`REEKS`,bestSuffix:`OP RIJ`,load:()=>z(()=>import(`./orbittac-CpqSAKv0.js`),__vite__mapDeps([5,1]))},{id:`neonstack`,title:`Neon Stack`,kicker:`3D · STAPELEN`,tagline:`Laat de blokken precies op elkaar vallen en bouw de hoogste toren.`,tint:`#ffd166`,glyph:`▤`,bestPrefix:`BESTE`,bestSuffix:`VERDIEPINGEN`,load:()=>z(()=>import(`./neonstack-pztwXl74.js`),__vite__mapDeps([6,1]))},{id:`cubehop`,title:`Cube Hop`,kicker:`3D · SPRINGEN`,tagline:`Spring van tegel naar tegel. Tegels storten in zodra je ervan af springt.`,tint:`#6effc4`,glyph:`⬢`,bestPrefix:`BESTE`,bestSuffix:`STAPPEN`,load:()=>z(()=>import(`./cubehop-zYcu-70v.js`),__vite__mapDeps([7,1]))},{id:`pong3d`,title:`Pong 3D`,kicker:`3D · ARENA`,tagline:`Sla de bal terug in een neon-arena. Wie eerst vijf punten haalt, wint.`,tint:`#ffb3e6`,glyph:`◐`,bestPrefix:`BESTE`,bestSuffix:`SLAGEN`,load:()=>z(()=>import(`./pong3d-Cuqqbnf8.js`),__vite__mapDeps([8,1]))},{id:`lightcycles`,title:`Light Cycles`,kicker:`3D · ARENA`,tagline:`Rijd als een neon-cycle en laat je spoor als muur achter. Laat de computer crashen.`,tint:`#3dfcff`,glyph:`◬`,bestPrefix:`BESTE`,bestSuffix:`KILLS`,load:()=>z(()=>import(`./lightcycles-BQJ90TAu.js`),__vite__mapDeps([9,1]))},{id:`breakout`,title:`Meteor Break`,kicker:`ARCADE · REFLEX`,tagline:`Een paddle, een bal en een hemel vol brokken die stuk moeten.`,tint:`#ff9d6e`,glyph:`◍`,load:()=>z(()=>import(`./breakout-5Llhq3YR.js`),[])},{id:`snake`,title:`Neon Snake`,kicker:`CLASSIC · GROEI`,tagline:`Eet, groei, en zorg dat je jezelf niet tegenkomt in het donker.`,tint:`#8ef5b0`,glyph:`◉`,load:()=>z(()=>import(`./snake-nAd8v0Jt.js`),[])},{id:`2048`,title:`2048`,kicker:`PUZZEL · GETALLEN`,tagline:`Schuif de tegels samen. Hoe ver kom je voordat het bord vol is?`,tint:`#f0c987`,glyph:`▦`,load:()=>z(()=>import(`./2048-Dvw_E8Cn.js`),[])},{id:`memory`,title:`Constellation`,kicker:`GEHEUGEN · STERREN`,tagline:`Draai de kaarten om en vind alle sterrenparen.`,tint:`#c9a7ff`,glyph:`✦`,bestPrefix:`MIN.`,bestSuffix:`ZETTEN`,load:()=>z(()=>import(`./memory-BJMQiFDD.js`),[])},{id:`blocks`,title:`Neon Blocks`,kicker:`PUZZEL · BLOKKEN`,tagline:`Laat de blokken vallen, draai ze en ruim zoveel mogelijk lijnen op.`,tint:`#6fe6ff`,glyph:`▥`,bestPrefix:`BESTE`,bestSuffix:`PTN`,load:()=>z(()=>import(`./blocks-B-ycfDaU.js`),[])},{id:`invaders`,title:`Star Swarm`,kicker:`ARCADE · SCHIETEN`,tagline:`De zwerm zakt steeds verder. Schiet terug voordat hij de grond raakt.`,tint:`#8ef5b0`,glyph:`✧`,bestPrefix:`BESTE`,bestSuffix:`PTN`,load:()=>z(()=>import(`./invaders-CtQnnRLD.js`),[])},{id:`wing`,title:`Neon Wing`,kicker:`ARCADE · VLIEGEN`,tagline:`Eén tik, één flap. Blijf tussen de poorten en haal een nieuw record.`,tint:`#ffe14d`,glyph:`◇`,bestPrefix:`BESTE`,bestSuffix:`POORTEN`,load:()=>z(()=>import(`./wing-Dh7CA9XX.js`),[])},{id:`shards`,title:`Shard Storm`,kicker:`ARCADE · RUIMTE`,tagline:`Breek de brokken tot stof. Elke grote steen splitst in twee kleinere.`,tint:`#c9a7ff`,glyph:`✳`,bestPrefix:`BESTE`,bestSuffix:`PTN`,load:()=>z(()=>import(`./shards-BcjwpQGq.js`),[])},{id:`maze`,title:`Maze Muncher`,kicker:`ARCADE · DOOLHOF`,tagline:`Eet alle stippen op en houd vier spoken uit je buurt.`,tint:`#ffe14d`,glyph:`◕`,bestPrefix:`BESTE`,bestSuffix:`PTN`,load:()=>z(()=>import(`./maze-DYlT1Nnw.js`),[])},{id:`quad`,title:`Orbit Four`,kicker:`STRATEGIE · VIER`,tagline:`Vier op een rij tegen de computer. Blokkeer hem voordat hij het doet.`,tint:`#ff6f91`,glyph:`●`,bestPrefix:`BESTE REEKS`,load:()=>z(()=>import(`./quad-CTZfNjPD.js`),[])},{id:`reflex`,title:`Reflex Rush`,kicker:`REFLEX · DOELEN`,tagline:`Veertig seconden, zoveel mogelijk doelen. Je combo verdubbelt je punten.`,tint:`#3dfcff`,glyph:`⊙`,bestPrefix:`BESTE`,bestSuffix:`PTN`,load:()=>z(()=>import(`./reflex-ckKBmrLz.js`),[])},{id:`slide`,title:`Nebula Slide`,kicker:`PUZZEL · SCHUIJVEN`,tagline:`Schuif de vijftien tegels op volgorde in zo weinig mogelijk zetten.`,tint:`#c9a7ff`,glyph:`▩`,bestPrefix:`MIN.`,bestSuffix:`ZETTEN`,load:()=>z(()=>import(`./slide-mAF6en0p.js`),[])},{id:`hoop`,title:`Hoop Shot`,kicker:`SPORT · BASKET`,tagline:`Sleep, mik en schiet de bal door de ring. De ring blijft in beweging.`,tint:`#ff9d6e`,glyph:`◔`,bestPrefix:`BESTE`,bestSuffix:`PTN`,load:()=>z(()=>import(`./hoop-CiSFlXMx.js`),[])}],V=new ke(document.getElementById(`hero-canvas`)),H=document.getElementById(`game-grid`);function U(e,t,n){let r=[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)),i=[1,3,5].map(e=>parseInt(t.slice(e,e+2),16));return`#`+r.map((e,t)=>Math.round(e+(i[t]-e)*n).toString(16).padStart(2,`0`)).join(``)}function Ge(e,t){let n=`pl-${e.id}`,r=U(e.tint,`#ffffff`,.5),i=U(e.tint,`#05060a`,.7),a=t%3,o=Array.from({length:34},(e,n)=>`<circle cx="${(n*47+t*31)%160}" cy="${(n*23+t*17)%100}" r="${n%7==0?.9:.4}" fill="#fff" opacity="${(.25+n%4*.15).toFixed(2)}"/>`).join(``),s=a===1?`<ellipse cx="80" cy="50" rx="52" ry="11" transform="rotate(-16 80 50)" fill="none" stroke="${e.tint}" stroke-width="1.4" opacity="0.3"/>`:``,c=a===1?`<g clip-path="url(#${n}-front)"><ellipse cx="80" cy="50" rx="52" ry="11" transform="rotate(-16 80 50)" fill="none" stroke="${e.tint}" stroke-width="1.8" opacity="0.9"/></g>`:``,l=a===0?`<circle cx="124" cy="26" r="4.5" fill="${i}" stroke="${r}" stroke-opacity="0.6" stroke-width="0.6"/>`:``;return`
    <svg class="planet" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="${n}-body" cx="34%" cy="30%" r="72%">
          <stop offset="0" stop-color="${r}"/>
          <stop offset="0.4" stop-color="${e.tint}"/>
          <stop offset="0.8" stop-color="${i}"/>
          <stop offset="1" stop-color="#05060a"/>
        </radialGradient>
        <radialGradient id="${n}-glow">
          <stop offset="0.6" stop-color="${e.tint}" stop-opacity="0.38"/>
          <stop offset="1" stop-color="${e.tint}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${n}-shine">
          <stop offset="0" stop-color="#fff" stop-opacity="0.6"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
        <clipPath id="${n}-clip"><circle cx="80" cy="50" r="30"/></clipPath>
        <clipPath id="${n}-front"><rect x="0" y="50" width="160" height="100"/></clipPath>
        <pattern id="${n}-tex" width="24" height="100" patternUnits="userSpaceOnUse">
          <path d="M5 0 C11 22 -1 40 7 58 S14 84 6 100" fill="none" stroke="${i}" stroke-width="3" opacity="0.45"/>
          <path d="M17 0 C12 18 22 46 16 66 S20 88 15 100" fill="none" stroke="${r}" stroke-width="1.2" opacity="0.25"/>
        </pattern>
        <filter id="${n}-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="${t+2}" result="n"/>
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.5 -0.55"/>
        </filter>
      </defs>
      ${o}
      ${s}
      <circle cx="80" cy="50" r="44" fill="url(#${n}-glow)"/>
      ${l}
      <circle cx="80" cy="50" r="30" fill="url(#${n}-body)"/>
      <g clip-path="url(#${n}-clip)">
        <g class="planet-texture"><rect x="-24" y="0" width="240" height="100" fill="url(#${n}-tex)"/></g>
        <rect x="50" y="20" width="60" height="60" filter="url(#${n}-grain)" opacity="0.22"/>
        <ellipse cx="69" cy="38" rx="10" ry="6" fill="url(#${n}-shine)" transform="rotate(-25 69 38)"/>
      </g>
      <circle cx="80" cy="50" r="30" fill="none" stroke="${r}" stroke-opacity="0.35" stroke-width="0.8"/>
      ${c}
    </svg>`}function Ke(e){let t=I(e.id);if(t===null)return`NOG NIET GESPEELD`;let n=e.bestPrefix||`BEST`,r=e.bestSuffix?` ${e.bestSuffix}`:``;return`${n} ${e.formatBest?e.formatBest(t):L(t)}${r}`}function W(){H.querySelectorAll(`[data-best]`).forEach(e=>{let t=B.find(t=>t.id===e.dataset.best);t&&(e.textContent=Ke(t))})}B.forEach((e,t)=>{let n=F(`button`,`card`);n.type=`button`,n.style.setProperty(`--tint`,e.tint),n.style.setProperty(`--i`,String(t)),n.dataset.game=e.id,n.dataset.reveal=``,n.setAttribute(`aria-label`,`${e.title} spelen`),n.innerHTML=`
    <div class="card-art">
      <span class="orbit"></span>
      <span class="orbit b"></span>
      ${Ge(e,t)}
      <span class="card-glyph" aria-hidden="true">${e.glyph}</span>
    </div>
    <div class="card-body">
      <span class="card-kicker">${e.kicker}</span>
      <h3>${e.title}</h3>
      <p>${e.tagline}</p>
      <div class="card-foot">
        <span class="card-best" data-best="${e.id}"></span>
        <span class="card-play">SPELEN</span>
      </div>
    </div>`,n.addEventListener(`pointermove`,e=>{if(window.matchMedia(`(pointer: coarse)`).matches)return;let t=n.getBoundingClientRect(),r=(e.clientX-t.left)/t.width-.5,i=(e.clientY-t.top)/t.height-.5;n.style.setProperty(`--mx`,`${(r+.5)*100}%`),n.style.setProperty(`--my`,`${(i+.5)*100}%`),n.style.transform=`perspective(1000px) rotateY(${r*4.5}deg) rotateX(${-i*4.5}deg) translateY(-4px)`}),n.addEventListener(`pointerleave`,()=>{n.style.transform=``}),n.addEventListener(`click`,()=>Ze(e.id)),H.appendChild(n)}),W();var G=document.getElementById(`game-shell`),K=document.getElementById(`game-stage`),qe=document.getElementById(`game-title`),Je=document.getElementById(`game-meta`),Ye=document.getElementById(`game-close`),Xe=document.getElementById(`game-restart`),q=null,J=!1;async function Ze(e){let t=B.find(t=>t.id===e);if(t&&!J){J=!0,qe.textContent=t.title,Je.textContent=t.kicker,K.innerHTML=``,G.hidden=!1,G.setAttribute(`aria-hidden`,`false`),document.body.classList.add(`no-scroll`),G.offsetHeight,G.classList.add(`ready`),V.stop(),await new Promise(e=>requestAnimationFrame(()=>requestAnimationFrame(e)));try{q={id:e,instance:(await t.load()).mount(K,{audio:P})},Xe.hidden=!1}catch(e){console.error(e),K.innerHTML=`<div class="game-overlay"><div class="ov-card">
      <p class="ov-kicker">ER GING IETS MIS</p>
      <h3>Deze wereld wilde niet openen</h3>
      <p class="ov-text">Probeer het nog eens. Details staan in de console.</p>
    </div></div>`}J=!1,Ye.focus({preventScroll:!0})}}function Qe(){if(q||!G.hidden){try{q?.instance?.destroy?.()}catch(e){console.error(e)}q=null,K.innerHTML=``,G.classList.remove(`ready`),G.hidden=!0,G.setAttribute(`aria-hidden`,`true`),document.body.classList.remove(`no-scroll`),W(),V.start(),P.blip()}}Ye.addEventListener(`click`,Qe),Xe.addEventListener(`click`,()=>{q?.instance?.restart?.(),P.blip()}),window.addEventListener(`keydown`,e=>{e.key===`Escape`&&!G.hidden&&(e.preventDefault(),Qe())});var Y=document.getElementById(`sound-toggle`);function $e(){Y.textContent=P.enabled?`GELUID AAN`:`GELUID UIT`,Y.setAttribute(`aria-pressed`,String(P.enabled))}$e(),Y.addEventListener(`click`,()=>{P.setEnabled(!P.enabled),$e(),P.enabled&&P.blip()}),document.getElementById(`hero-play`).addEventListener(`click`,()=>{document.getElementById(`games`).scrollIntoView({behavior:`smooth`,block:`start`}),P.blip()});var X=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;function et(e){let t=B.length;if(X){e.textContent=String(t);return}let n=performance.now(),r=i=>{let a=Math.min(1,(i-n)/1200),o=1-(1-a)**3;e.textContent=String(Math.round(t*o)),a<1&&requestAnimationFrame(r)};requestAnimationFrame(r)}var tt=new IntersectionObserver(e=>{for(let t of e){if(!t.isIntersecting)continue;let e=t.target;e.classList.add(`is-in`),e.hasAttribute(`data-count`)&&et(e),tt.unobserve(e)}},{threshold:.15,rootMargin:`0px 0px -8% 0px`});document.querySelectorAll(`[data-reveal]`).forEach(e=>tt.observe(e));var nt=document.querySelector(`.scroll-progress`),Z=document.querySelector(`.hero-title`),Q=!1;function rt(){Q=!1;let e=window.scrollY,t=document.documentElement.scrollHeight-window.innerHeight;nt.style.transform=`scaleX(${t>0?Math.min(1,e/t):0})`,!X&&Z&&e<window.innerHeight&&(Z.style.transform=`translate3d(0, ${e*.3}px, 0)`,Z.style.opacity=String(Math.max(0,1-e/(window.innerHeight*.7))))}window.addEventListener(`scroll`,()=>{Q||(Q=!0,requestAnimationFrame(rt))},{passive:!0}),rt();var $=document.querySelector(`.cursor-glow`),it=window.matchMedia(`(pointer: fine)`).matches;if($&&it&&!X){let e=0,t=0,n=0,r=0,i=!1,a=()=>{i=!1,e+=(n-e)*.18,t+=(r-t)*.18,$.style.transform=`translate3d(${e-210}px, ${t-210}px, 0)`,(Math.abs(n-e)>.5||Math.abs(r-t)>.5)&&(i=!0,requestAnimationFrame(a))};window.addEventListener(`pointermove`,e=>{n=e.clientX,r=e.clientY,$.classList.add(`is-on`),i||(i=!0,requestAnimationFrame(a))},{passive:!0})}export{O as _,I as a,Ie as c,Me as d,Pe as f,k as g,we as h,Fe as i,Ne as l,P as m,R as n,je as o,Le as p,L as r,Re as s,Ae as t,ze as u,D as v};