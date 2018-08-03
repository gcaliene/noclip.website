
import { mat4, mat2d } from 'gl-matrix';

import { BMD, BMT, BTK, HierarchyNode, HierarchyType, MaterialEntry, Shape, ShapeDisplayFlags, TEX1_Sampler, TEX1_TextureData, BRK, DRW1JointKind, BCK } from './j3d';

import * as GX_Material from '../gx/gx_material';
import { MaterialParams, SceneParams, GXRenderHelper, PacketParams, GXShapeHelper, loadedDataCoalescer, fillSceneParamsFromRenderState, translateTexFilter, translateWrapMode, GXTextureHolder } from '../gx/gx_render';
import * as Viewer from '../viewer';

import { RenderFlags, RenderState } from '../render';
import { computeViewMatrix, computeModelMatrixBillboard, computeModelMatrixYBillboard, computeViewMatrixSkybox, texEnvMtx, AABB, IntersectionState } from '../Camera';
import BufferCoalescer, { CoalescedBuffers } from '../BufferCoalescer';
import { TextureMapping } from '../TextureHolder';

export class J3DTextureHolder extends GXTextureHolder<TEX1_TextureData> {
    public addJ3DTextures(gl: WebGL2RenderingContext, bmd: BMD, bmt: BMT = null) {
        this.addTextures(gl, bmd.tex1.textureDatas);
        if (bmt)
            this.addTextures(gl, bmt.tex1.textureDatas);
    }
}

function texProjPerspMtx(dst: mat4, fov: number, aspect: number, scaleS: number, scaleT: number, transS: number, transT: number): void {
    const cot = 1 / Math.tan(fov / 2);

    dst[0] = (cot / aspect) * scaleS;
    dst[4] = 0.0;
    dst[8] = -transS;
    dst[12] = 0.0;

    dst[1] = 0.0;
    dst[5] = cot * scaleT;
    dst[9] = -transT;
    dst[13] = 0.0;

    dst[2] = 0.0;
    dst[6] = 0.0;
    dst[10] = -1.0;
    dst[14] = 0.0;

    // Fill with junk to try and signal when something has gone horribly wrong. This should go unused,
    // since this is supposed to generate a mat4x3 matrix.
    dst[3] = 9999.0;
    dst[7] = 9999.0;
    dst[11] = 9999.0;
    dst[15] = 9999.0;
}

function texProjOrthoMtx(dst: mat4, t: number, b: number, l: number, r: number, scaleS: number, scaleT: number, transS: number, transT: number): void {
    const h = 1 / (r - l);
    dst[0] = 2.0 * h * scaleS;
    dst[4] = 0.0;
    dst[8] = 0.0;
    dst[12] = ((-(r + l) * h) * scaleS) + transS;

    const v = 1 / (t - b);
    dst[1] = 0.0;
    dst[5] = 2.0 * v * scaleT;
    dst[9] = -transT;
    dst[13] = ((-(t + b) * v) * scaleT) + transT;

    dst[2] = 0.0;
    dst[6] = 0.0;
    dst[10] = -1.0;
    dst[14] = 0.0;

    dst[3] = 0.0;
    dst[7] = 0.0;
    dst[11] = 0.0;
    dst[15] = 1.0;
}

const scratchModelMatrix = mat4.create();
const scratchViewMatrix = mat4.create();
class Command_Shape {
    private packetParams = new PacketParams();
    private shapeHelpers: GXShapeHelper[] = [];

    constructor(gl: WebGL2RenderingContext, sceneLoader: SceneLoader, private scene: Scene, private shape: Shape, coalescedBuffers: CoalescedBuffers[]) {
        this.shapeHelpers = shape.packets.map((packet) => {
            return new GXShapeHelper(gl, coalescedBuffers.shift(), this.shape.loadedVertexLayout, packet.loadedVertexData);
        })
    }

    private computeModelView(state: RenderState): mat4 {
        mat4.copy(scratchModelMatrix, this.scene.modelMatrix);

        switch (this.shape.displayFlags) {
        case ShapeDisplayFlags.NORMAL:
        case ShapeDisplayFlags.USE_PNMTXIDX:
            // We should already be using PNMTXIDX in the normal case -- it's hardwired to 0.
            break;

        case ShapeDisplayFlags.BILLBOARD:
            computeModelMatrixBillboard(scratchModelMatrix, state.camera);
            mat4.mul(scratchModelMatrix, this.scene.modelMatrix, scratchModelMatrix);
            break;
        case ShapeDisplayFlags.Y_BILLBOARD:
            computeModelMatrixYBillboard(scratchModelMatrix, state.camera);
            mat4.mul(scratchModelMatrix, this.scene.modelMatrix, scratchModelMatrix);
            break;
        default:
            throw new Error("whoops");
        }

        if (this.scene.isSkybox) {
            computeViewMatrixSkybox(scratchViewMatrix, state.camera);
        } else {
            computeViewMatrix(scratchViewMatrix, state.camera);
        }

        mat4.mul(scratchViewMatrix, scratchViewMatrix, scratchModelMatrix);
        return scratchViewMatrix;
    }

    public exec(state: RenderState) {
        if (!this.scene.currentMaterialCommand.visible)
            return;

        const gl = state.gl;

        const modelView = this.computeModelView(state);

        let needsUpload = false;

        const posMtxVisibility: IntersectionState[] = new Array(10);
        for (let p = 0; p < this.shape.packets.length; p++) {
            const packet = this.shape.packets[p];

            // Update our matrix table.
            for (let i = 0; i < packet.matrixTable.length; i++) {
                const matrixIndex = packet.matrixTable[i];

                // Leave existing matrix.
                if (matrixIndex === 0xFFFF)
                    continue;

                const posMtx = this.scene.weightedJointMatrices[matrixIndex];
                posMtxVisibility[i] = this.scene.matrixVisibility[matrixIndex];
                mat4.mul(this.packetParams.u_PosMtx[i], modelView, posMtx);
                needsUpload = true;
            }

            // If all matrices are invisible, we can cull.
            let frustumCull = true;
            for (let i = 0; i < posMtxVisibility.length; i++) {
                if (posMtxVisibility[i] !== IntersectionState.FULLY_OUTSIDE) {
                    frustumCull = false;
                    break;
                }
            }

            if (frustumCull)
                return;

            if (needsUpload) {
                this.scene.renderHelper.bindPacketParams(state, this.packetParams);
                needsUpload = false;
            }

            const shapeHelper = this.shapeHelpers[p];
            shapeHelper.drawSimple(state);
            /*
            shapeHelper.drawPrologue(gl);
            shapeHelper.drawTriangles(gl, packet.firstTriangle, packet.numTriangles);
            shapeHelper.drawEpilogue(gl);
            */
        }

        state.renderStatisticsTracker.drawCallCount++;
    }

    public destroy(gl: WebGL2RenderingContext) {
        this.shapeHelpers.forEach((shapeHelper) => shapeHelper.destroy(gl));
    }
}

interface Command_MaterialScene {
    brk: BRK;
    btk: BTK;
    currentMaterialCommand: Command_Material;
    getTimeInFrames(milliseconds: number): number;
    colorOverrides: GX_Material.Color[];
    alphaOverrides: number[];
    renderHelper: GXRenderHelper;
    fillTextureMapping(m: TextureMapping, i: number): void;
}

export class Command_Material {
    private static matrixScratch = mat4.create();
    private static materialParams = new MaterialParams();

    public material: MaterialEntry;

    public name: string;
    public visible: boolean = true;

    private scene: Command_MaterialScene;
    private renderFlags: RenderFlags;
    public program: GX_Material.GX_Program;

    constructor(scene: Command_MaterialScene, material: MaterialEntry, hacks?: GX_Material.GXMaterialHacks) {
        this.name = material.name;
        this.scene = scene;
        this.material = material;
        this.program = new GX_Material.GX_Program(material.gxMaterial, hacks);
        this.program.name = this.name;
        this.renderFlags = GX_Material.translateRenderFlags(this.material.gxMaterial);
    }

    public exec(state: RenderState) {
        this.scene.currentMaterialCommand = this;

        if (!this.scene.currentMaterialCommand.visible)
            return;

        state.useProgram(this.program);
        state.useFlags(this.renderFlags);

        const materialParams = Command_Material.materialParams;
        this.fillMaterialParams(materialParams, state);
        this.scene.renderHelper.bindMaterialParams(state, materialParams);
        this.scene.renderHelper.bindMaterialTextures(state, materialParams, this.program);
    }

    public destroy(gl: WebGL2RenderingContext) {
        this.program.destroy(gl);
    }

    private fillMaterialParams(materialParams: MaterialParams, state: RenderState): void {
        const animationFrame = this.scene.getTimeInFrames(state.time);

        const copyColor = (i: ColorOverride, dst: GX_Material.Color, fallbackColor: GX_Material.Color) => {
            // First, check for a color animation.
            if (this.scene.brk !== null) {
                if (this.scene.brk.calcColorOverride(dst, this.material.name, i, animationFrame))
                    return;
            }

            let color: GX_Material.Color;
            if (this.scene.colorOverrides[i]) {
                color = this.scene.colorOverrides[i];
            } else {
                color = fallbackColor;
            }

            let alpha: number;
            if (this.scene.alphaOverrides[i] !== undefined) {
                alpha = this.scene.alphaOverrides[i];
            } else {
                alpha = fallbackColor.a;
            }

            dst.copy(color, alpha);
        };

        copyColor(ColorOverride.MAT0, materialParams.u_ColorMatReg[0], this.material.colorMatRegs[0]);
        copyColor(ColorOverride.MAT1, materialParams.u_ColorMatReg[1], this.material.colorMatRegs[1]);
        copyColor(ColorOverride.AMB0, materialParams.u_ColorAmbReg[0], this.material.colorAmbRegs[0]);
        copyColor(ColorOverride.AMB1, materialParams.u_ColorAmbReg[1], this.material.colorAmbRegs[1]);

        copyColor(ColorOverride.K0, materialParams.u_KonstColor[0], this.material.gxMaterial.colorConstants[0]);
        copyColor(ColorOverride.K1, materialParams.u_KonstColor[1], this.material.gxMaterial.colorConstants[1]);
        copyColor(ColorOverride.K2, materialParams.u_KonstColor[2], this.material.gxMaterial.colorConstants[2]);
        copyColor(ColorOverride.K3, materialParams.u_KonstColor[3], this.material.gxMaterial.colorConstants[3]);

        copyColor(ColorOverride.CPREV, materialParams.u_Color[0], this.material.gxMaterial.colorRegisters[0]);
        copyColor(ColorOverride.C0, materialParams.u_Color[1], this.material.gxMaterial.colorRegisters[1]);
        copyColor(ColorOverride.C1, materialParams.u_Color[2], this.material.gxMaterial.colorRegisters[2]);
        copyColor(ColorOverride.C2, materialParams.u_Color[3], this.material.gxMaterial.colorRegisters[3]);

        // Bind textures.
        for (let i = 0; i < this.material.textureIndexes.length; i++) {
            const texIndex = this.material.textureIndexes[i];
            if (texIndex >= 0) {
                this.scene.fillTextureMapping(materialParams.m_TextureMapping[i], texIndex);
            } else {
                materialParams.m_TextureMapping[i].glTexture = null;
            }
        }

        // Bind our texture matrices.
        const scratch = Command_Material.matrixScratch;
        for (let i = 0; i < this.material.texMatrices.length; i++) {
            const texMtx = this.material.texMatrices[i];
            if (texMtx === null)
                continue;

            const dst = materialParams.u_TexMtx[i];
            const flipY = materialParams.m_TextureMapping[i].flipY;
            const flipYScale = flipY ? -1.0 : 1.0;

            // First, compute input matrix.
            switch (texMtx.type) {
            case 0x00:
            case 0x01: // Delfino Plaza
            case 0x0B: // Luigi Circuit
            case 0x08: // Peach Beach.
                // No mapping.
                mat4.identity(dst);
                break;
            case 0x06: // Rainbow Road
            case 0x07: // Rainbow Road
                // Environment mapping. Uses the normal matrix.
                // Normal matrix. Emulated here by the view matrix with the translation lopped off...
                mat4.copy(dst, state.view);
                dst[12] = 0;
                dst[13] = 0;
                dst[14] = 0;
                break;
            case 0x09:
                // Projection. Used for indtexwater, mostly.
                mat4.copy(dst, state.view);
                break;
            default:
                throw "whoops";
            }

            // Now apply effects.
            switch(texMtx.type) {
            case 0x00:
            case 0x01:
            case 0x0B:
                break;
            case 0x06: // Rainbow Road
                // Environment mapping
                texEnvMtx(scratch, -0.5, -0.5 * flipYScale, 0.5, 0.5);
                mat4.mul(dst, scratch, dst);
                mat4.mul(dst, texMtx.effectMatrix, dst);
                break;
            case 0x07: // Rainbow Road
            case 0x08: // Peach Beach
                mat4.mul(dst, texMtx.effectMatrix, dst);
                texProjPerspMtx(scratch, state.fov, state.getAspect(), 0.5, -0.5 * flipYScale, 0.5, 0.5);
                mat4.mul(dst, scratch, dst);
                break;
            case 0x09: // Rainbow Road
                // Perspective.
                // Don't apply effectMatrix to perspective. It appears to be
                // a projection matrix preconfigured for GC.
                // mat4.mul(dst, texMtx.effectMatrix, dst);
                texProjPerspMtx(scratch, state.fov, state.getAspect(), 0.5, -0.5 * flipYScale, 0.5, 0.5);
                mat4.mul(dst, scratch, dst);
                break;
            default:
                throw "whoops";
            }

            // Apply SRT.
            mat4.copy(scratch, texMtx.matrix);

            if (this.scene.btk !== null)
                this.scene.btk.calcAnimatedTexMtx(scratch, this.material.name, i, animationFrame);

            // SRT matrices have translation in fourth component, but we want our matrix to have translation
            // in third component. Swap.
            const tx = scratch[12];
            scratch[12] = scratch[8];
            scratch[8] = tx;
            const ty = scratch[13];
            scratch[13] = scratch[9];
            scratch[9] = ty;

            mat4.mul(dst, scratch, dst);
        }

        for (let i = 0; i < this.material.postTexMatrices.length; i++) {
            const postTexMtx = this.material.postTexMatrices[i];
            if (postTexMtx === null)
                continue;

            const finalMatrix = postTexMtx.matrix;
            mat4.copy(materialParams.u_PostTexMtx[i], finalMatrix);
        }

        for (let i = 0; i < this.material.indTexMatrices.length; i++) {
            const indTexMtx = this.material.indTexMatrices[i];
            if (indTexMtx === null)
                continue;

            const a = indTexMtx[0], c = indTexMtx[1], tx = indTexMtx[2];
            const b = indTexMtx[3], d = indTexMtx[4], ty = indTexMtx[5];
            mat2d.set(materialParams.u_IndTexMtx[i], a, b, c, d, tx, ty);
        }
    }
}

type Command = Command_Shape | Command_Material;

export enum ColorOverride {
    MAT0, MAT1, AMB0, AMB1,
    K0, K1, K2, K3,
    CPREV, C0, C1, C2,
}

const matrixScratch = mat4.create(), matrixScratch2 = mat4.create();

// SceneLoaderToken is a private class that's passed to Scene.
// Basically, this emulates an internal constructor by making
// it impossible to call...
class SceneLoaderToken {
    constructor(public gl: WebGL2RenderingContext) {}
}

export class SceneLoader {
    constructor(
        public textureHolder: J3DTextureHolder,
        public bmd: BMD,
        public bmt: BMT | null = null,
        public materialHacks?: GX_Material.GXMaterialHacks)
    {}

    public createScene(gl: WebGL2RenderingContext): Scene {
        return new Scene(new SceneLoaderToken(gl), this);
    }
}

export class Scene implements Viewer.Scene {
    public textures: Viewer.Texture[];

    public name: string = '';
    public visible: boolean = true;
    public isSkybox: boolean = false;
    public fps: number = 30;

    public modelMatrix: mat4;

    public colorOverrides: GX_Material.Color[] = [];
    public alphaOverrides: number[] = [];
    public renderHelper: GXRenderHelper;
    private sceneParams = new SceneParams();

    // BMD
    public bmd: BMD;
    // TODO(jstpierre): Make BMT settable after load...
    public bmt: BMT | null = null;

    // Animations.
    public bck: BCK | null = null;
    public brk: BRK | null = null;
    public btk: BTK | null = null;
    public textureHolder: J3DTextureHolder;

    // Texture information.
    private tex1Samplers: TEX1_Sampler[];
    private glSamplers: WebGLSampler[];

    public currentMaterialCommand: Command_Material;

    public materialCommands: Command_Material[];
    private shapeCommands: Command_Shape[];
    private jointMatrices: mat4[];
    public weightedJointMatrices: mat4[];
    private jointVisibility: IntersectionState[] = [];
    public matrixVisibility: IntersectionState[] = [];
    private bboxScratch: AABB = new AABB();

    private bufferCoalescer: BufferCoalescer;

    private opaqueCommands: Command[];
    private transparentCommands: Command[];
    private materialHacks?: GX_Material.GXMaterialHacks;

    constructor(
        sceneLoaderToken: SceneLoaderToken,
        sceneLoader: SceneLoader,
    ) {
        const gl = sceneLoaderToken.gl;
        this.bmd = sceneLoader.bmd;
        this.bmt = sceneLoader.bmt;
        this.textureHolder = sceneLoader.textureHolder;
        this.materialHacks = sceneLoader.materialHacks;

        // TODO(jstpierre): Remove textures from Scene onto MainScene.
        this.textures = this.textureHolder.viewerTextures;

        this.translateModel(gl, sceneLoader);

        this.renderHelper = new GXRenderHelper(gl);
        this.modelMatrix = mat4.create();
    }

    public destroy(gl: WebGL2RenderingContext) {
        this.renderHelper.destroy(gl);
        this.bufferCoalescer.destroy(gl);
        this.materialCommands.forEach((command) => command.destroy(gl));
        this.shapeCommands.forEach((command) => command.destroy(gl));
        this.glSamplers.forEach((sampler) => gl.deleteSampler(sampler));
    }

    public setColorOverride(i: ColorOverride, color: GX_Material.Color) {
        this.colorOverrides[i] = color;
    }

    public setAlphaOverride(i: ColorOverride, alpha: number) {
        this.alphaOverrides[i] = alpha;
    }

    public setIsSkybox(v: boolean) {
        this.isSkybox = v;
    }

    public setFPS(v: number) {
        this.fps = v;
    }

    public setVisible(v: boolean): void {
        this.visible = v;
    }

    public setBCK(bck: BCK | null): void {
        this.bck = bck;
    }

    public setBRK(brk: BRK | null): void {
        this.brk = brk;
    }

    public setBTK(btk: BTK | null): void {
        this.btk = btk;
    }

    public fillTextureMapping(m: TextureMapping, texIndex: number): void {
        const tex1Sampler = this.tex1Samplers[texIndex];

        this.textureHolder.fillTextureMapping(m, tex1Sampler.name);
        m.glSampler = this.glSamplers[tex1Sampler.index];
        m.lodBias = tex1Sampler.lodBias;
    }

    public getTimeInFrames(milliseconds: number) {
        return (milliseconds / 1000) * this.fps;
    }

    public bindState(state: RenderState): boolean {
        if (!this.visible)
            return false;

        // XXX(jstpierre): Is this the right place to do this? Need an explicit update call...
        this.updateJointMatrices(state);

        this.renderHelper.bindUniformBuffers(state);

        fillSceneParamsFromRenderState(this.sceneParams, state);
        this.renderHelper.bindSceneParams(state, this.sceneParams);

        return true;
    }

    public renderOpaque(state: RenderState) {
        this.execCommands(state, this.opaqueCommands);
    }

    public renderTransparent(state: RenderState) {
        this.execCommands(state, this.transparentCommands);
    }

    public render(state: RenderState) {
        if (!this.bindState(state))
            return;

        this.renderOpaque(state);
        this.renderTransparent(state);
    }

    private execCommands(state: RenderState, commands: Command[]) {
        commands.forEach((command, i) => {
            command.exec(state);
        });
    }

    public static translateSampler(gl: WebGL2RenderingContext, sampler: TEX1_Sampler): WebGLSampler {
        const glSampler = gl.createSampler();
        gl.samplerParameteri(glSampler, gl.TEXTURE_MIN_FILTER, translateTexFilter(gl, sampler.minFilter));
        gl.samplerParameteri(glSampler, gl.TEXTURE_MAG_FILTER, translateTexFilter(gl, sampler.magFilter));
        gl.samplerParameteri(glSampler, gl.TEXTURE_WRAP_S, translateWrapMode(gl, sampler.wrapS));
        gl.samplerParameteri(glSampler, gl.TEXTURE_WRAP_T, translateWrapMode(gl, sampler.wrapT));
        gl.samplerParameterf(glSampler, gl.TEXTURE_MIN_LOD, sampler.minLOD);
        gl.samplerParameterf(glSampler, gl.TEXTURE_MAX_LOD, sampler.maxLOD);
        return glSampler;
    }

    public translateTextures(gl: WebGL2RenderingContext, sceneLoader: SceneLoader) {
        const tex1 = sceneLoader.bmt !== null ? sceneLoader.bmt.tex1 : sceneLoader.bmd.tex1;

        // TODO(jstpierre): How does separable textureData / sampler work with external
        // texture resolve?

        this.glSamplers = [];
        for (let sampler of tex1.samplers) {
            this.glSamplers.push(Scene.translateSampler(gl, sampler));
        }

        this.tex1Samplers = tex1.samplers;
    }

    private translateModel(gl: WebGL2RenderingContext, sceneLoader: SceneLoader) {
        const bmd = sceneLoader.bmd;
        const bmt = sceneLoader.bmt;
        const mat3 = (bmt !== null && bmt.mat3 !== null) ? bmt.mat3 : bmd.mat3;

        this.opaqueCommands = [];
        this.transparentCommands = [];

        this.jointMatrices = [];
        for (let i = 0; i < bmd.jnt1.bones.length; i++)
            this.jointMatrices[i] = mat4.create();

        this.weightedJointMatrices = [];
        for (const drw1Joint of bmd.drw1.drw1Joints)
            this.weightedJointMatrices.push(mat4.create());

        this.translateTextures(gl, sceneLoader);

        this.materialCommands = mat3.materialEntries.map((material) => {
            return new Command_Material(this, material, this.materialHacks);
        });

        const loadedVertexDatas = [];
        for (const shape of bmd.shp1.shapes)
            for (const packet of shape.packets)
                loadedVertexDatas.push(packet.loadedVertexData);
        this.bufferCoalescer = loadedDataCoalescer(gl, loadedVertexDatas);
        this.shapeCommands = bmd.shp1.shapes.map((shape, i) => {
            return new Command_Shape(gl, sceneLoader, this, shape, this.bufferCoalescer.coalescedBuffers);
        });

        // Iterate through scene graph.
        this.translateSceneGraph(bmd.inf1.sceneGraph, null);
    }

    private translateSceneGraph(node: HierarchyNode, commandList: Command[]) {
        switch (node.type) {
        case HierarchyType.Shape:
            commandList.push(this.shapeCommands[node.shapeIdx]);
            break;
        case HierarchyType.Material:
            const materialCommand = this.materialCommands[node.materialIdx];
            commandList = materialCommand.material.translucent ? this.transparentCommands : this.opaqueCommands;
            commandList.push(materialCommand);
            break;
        }

        for (const child of node.children)
            this.translateSceneGraph(child, commandList);
    }

    private updateJointMatrixHierarchy(state: RenderState, node: HierarchyNode, parentJointMatrix: mat4) {
        // TODO(jstpierre): Don't pointer chase when traversing hierarchy every frame...
        const jnt1 = this.bmd.jnt1;
        const bbox = this.bboxScratch;

        switch (node.type) {
        case HierarchyType.Joint:
            const jointIndex = node.jointIdx;

            let boneMatrix: mat4;
            if (this.bck !== null && this.bck.ank1.jointAnimationEntries[jointIndex]) {
                boneMatrix = matrixScratch2;
                this.bck.calcJointMatrix(boneMatrix, jointIndex, this.getTimeInFrames(state.time));
            } else {
                boneMatrix = jnt1.bones[jointIndex].matrix;
            }

            const dstJointMatrix = this.jointMatrices[jointIndex];
            mat4.mul(dstJointMatrix, parentJointMatrix, boneMatrix);

            // Frustum cull.
            bbox.transform(jnt1.bones[jointIndex].bbox, dstJointMatrix);
            this.jointVisibility[jointIndex] = state.camera.frustum.intersect(bbox);

            // Now update children.
            for (let i = 0; i < node.children.length; i++)
                this.updateJointMatrixHierarchy(state, node.children[i], dstJointMatrix);
            break;
        default:
            // Pass through.
            for (let i = 0; i < node.children.length; i++)
                this.updateJointMatrixHierarchy(state, node.children[i], parentJointMatrix);
            break;
        }
    }

    private updateJointMatrices(state: RenderState) {
        // First, update joint matrices from hierarchy.
        mat4.identity(matrixScratch);
        this.updateJointMatrixHierarchy(state, this.bmd.inf1.sceneGraph, matrixScratch);

        // Update weighted joint matrices.
        for (let i = 0; i < this.bmd.drw1.drw1Joints.length; i++) {
            const joint = this.bmd.drw1.drw1Joints[i];
            const destMtx = this.weightedJointMatrices[i];
            if (joint.kind === DRW1JointKind.NormalJoint) {
                mat4.copy(destMtx, this.jointMatrices[joint.jointIndex]);
                this.matrixVisibility[i] = this.jointVisibility[joint.jointIndex];
            } else if (joint.kind === DRW1JointKind.WeightedJoint) {
                destMtx.fill(0);
                const envelope = this.bmd.evp1.envelopes[joint.envelopeIndex];
                for (let i = 0; i < envelope.weightedBones.length; i++) {
                    const weightedBone = envelope.weightedBones[i];
                    const inverseBindPose = this.bmd.evp1.inverseBinds[weightedBone.index];
                    mat4.mul(matrixScratch, this.jointMatrices[weightedBone.index], inverseBindPose);
                    mat4.multiplyScalarAndAdd(destMtx, destMtx, matrixScratch, weightedBone.weight);
                }
                // TODO(jstpierre): Frustum cull weighted joints.
                this.matrixVisibility[i] = IntersectionState.FULLY_INSIDE;
            }
        }
    }
}
