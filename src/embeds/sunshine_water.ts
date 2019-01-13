
import { mat4 } from 'gl-matrix';

import ArrayBufferSlice from '../ArrayBufferSlice';
import Progressable from '../Progressable';

import { fetchData } from '../fetch';
import { SceneGfx, ViewerRenderInput } from '../viewer';

import * as GX from '../gx/gx_enum';
import * as GX_Material from '../gx/gx_material';

import { BMD, BTK, MaterialEntry } from '../j3d/j3d';
import * as RARC from '../j3d/rarc';
import { MaterialData, J3DTextureHolder, BMDModel, MaterialInstance } from '../j3d/render';
import { SunshineRenderer, SunshineSceneDesc, SMSPass } from '../j3d/sms_scenes';
import * as Yaz0 from '../compression/Yaz0';
import { GXRenderHelperGfx, ub_PacketParams } from '../gx/gx_render';
import AnimationController from '../AnimationController';
import { GfxDevice, GfxHostAccessPass, GfxBuffer, GfxInputState, GfxInputLayout, GfxBufferUsage, GfxVertexAttributeDescriptor, GfxFormat, GfxVertexAttributeFrequency, GfxVertexBufferDescriptor } from '../gfx/platform/GfxPlatform';
import { makeStaticDataBuffer } from '../gfx/helpers/BufferHelpers';
import { GfxRenderInst } from '../gfx/render/GfxRenderer';
import { makeTriangleIndexBuffer, GfxTopology } from '../gfx/helpers/TopologyHelpers';

const scale = 200;
const posMtx = mat4.create();
mat4.fromScaling(posMtx, [scale, scale, scale]);

class SeaPlaneScene {
    private seaMaterial: MaterialData;
    private seaMaterialInstance: MaterialInstance;
    private plane: PlaneShape;
    private bmdModel: BMDModel;
    private animationController: AnimationController;

    constructor(device: GfxDevice, renderHelper: GXRenderHelperGfx, private textureHolder: J3DTextureHolder, bmd: BMD, btk: BTK, configName: string) {
        this.animationController = new AnimationController();
        // Make it go fast.
        this.animationController.fps = 30 * 5;

        if (configName.includes('nomip')) {
            for (const sampler of bmd.tex1.samplers) {
                sampler.minLOD = 1;
                sampler.maxLOD = 1;
            }
        }

        this.bmdModel = new BMDModel(device, renderHelper, bmd);

        textureHolder.addJ3DTextures(device, bmd);

        const seaMaterial = bmd.mat3.materialEntries.find((m) => m.name === '_umi');
        this.seaMaterial = this.makeMaterialData(device, seaMaterial, configName);
        this.seaMaterialInstance = new MaterialInstance(device, renderHelper, null, this.seaMaterial);
        this.seaMaterialInstance.bindTTK1(this.animationController, btk.ttk1);
        const renderInstBuilder = renderHelper.renderInstBuilder;
        renderInstBuilder.pushTemplateRenderInst(this.seaMaterialInstance.templateRenderInst);
        this.plane = new PlaneShape(device, renderHelper);
        renderInstBuilder.popTemplateRenderInst();
    }

    public makeMaterialData(device: GfxDevice, material: MaterialEntry, configName: string) {
        const gxMaterial = material.gxMaterial;

        if (configName.includes('noalpha')) {
            // Disable alpha test
            gxMaterial.alphaTest.compareA = GX.CompareType.ALWAYS;
            gxMaterial.alphaTest.op = GX.AlphaOp.OR;
        }

        if (configName.includes('noblend')) {
            // Disable blending.
            gxMaterial.tevStages[0].alphaInD = GX.CombineAlphaInput.KONST;
            gxMaterial.tevStages[1].alphaInD = GX.CombineAlphaInput.KONST;
            gxMaterial.ropInfo.blendMode.srcFactor = GX.BlendFactor.ONE;
            gxMaterial.ropInfo.blendMode.dstFactor = GX.BlendFactor.ZERO;
        }

        if (configName.includes('opaque')) {
            // Make it always opaque.
            gxMaterial.tevStages[0].colorInB = GX.CombineColorInput.TEXA;
            gxMaterial.tevStages[0].colorInC = GX.CombineColorInput.RASA;
            gxMaterial.tevStages[0].colorInD = GX.CombineColorInput.CPREV;
            gxMaterial.tevStages[0].colorScale = GX.TevScale.SCALE_1;
            gxMaterial.tevStages[1].colorInB = GX.CombineColorInput.TEXA;
            gxMaterial.tevStages[1].colorInC = GX.CombineColorInput.RASA;
            gxMaterial.tevStages[1].colorInD = GX.CombineColorInput.CPREV;
            gxMaterial.tevStages[1].colorScale = GX.TevScale.SCALE_1;
            gxMaterial.tevStages[1].colorClamp = true;

            // Use one TEV stage.
            if (configName.includes('layer0')) {
                gxMaterial.tevStages.length = 1;
            } else if (configName.includes('layer1')) {
                gxMaterial.tevStages[0] = gxMaterial.tevStages[1];
                gxMaterial.tevStages.length = 1;
            }
        }

        return new MaterialData(device, material);
    }

    public prepareToRender(renderHelper: GXRenderHelperGfx, viewerInput: ViewerRenderInput): void {
        this.seaMaterialInstance.prepareToRender(renderHelper, viewerInput, this.bmdModel, this.textureHolder);
    }

    public destroy(device: GfxDevice) {
        this.plane.destroy(device);
        this.seaMaterial.destroy(device);
        this.bmdModel.destroy(device);
    }
}

class PlaneShape {
    private vtxBuffer: GfxBuffer;
    private idxBuffer: GfxBuffer;
    private inputLayout: GfxInputLayout;
    private inputState: GfxInputState;
    private renderInst: GfxRenderInst;

    constructor(device: GfxDevice, renderHelper: GXRenderHelperGfx) {
        const vtx = new Float32Array(4 * 5);
        vtx[0]  = -1;
        vtx[1]  = 0;
        vtx[2]  = -1;
        vtx[3] = 0;
        vtx[4] = 0;

        vtx[5]  = 1;
        vtx[6]  = 0;
        vtx[7]  = -1;
        vtx[8]  = 2;
        vtx[9]  = 0;

        vtx[10] = -1;
        vtx[11] = 0;
        vtx[12] = 1;
        vtx[13] = 0;
        vtx[14] = 2;

        vtx[15] = 1;
        vtx[16] = 0;
        vtx[17] = 1;
        vtx[18] = 2;
        vtx[19] = 2;

        this.vtxBuffer = makeStaticDataBuffer(device, GfxBufferUsage.VERTEX, vtx.buffer);
        this.idxBuffer = makeStaticDataBuffer(device, GfxBufferUsage.INDEX, makeTriangleIndexBuffer(GfxTopology.TRISTRIP, 0, 4).buffer);

        const posAttribLocation = GX_Material.getVertexAttribLocation(GX.VertexAttribute.POS);
        const txcAttribLocation = GX_Material.getVertexAttribLocation(GX.VertexAttribute.TEX0);
        const vertexAttributeDescriptors: GfxVertexAttributeDescriptor[] = [
            { location: posAttribLocation, format: GfxFormat.F32_RGB, bufferByteOffset: 4*0, bufferIndex: 0, frequency: GfxVertexAttributeFrequency.PER_VERTEX, },
            { location: txcAttribLocation, format: GfxFormat.F32_RGB, bufferByteOffset: 4*3, bufferIndex: 0, frequency: GfxVertexAttributeFrequency.PER_VERTEX, },
        ];
        this.inputLayout = device.createInputLayout({
            vertexAttributeDescriptors,
            indexBufferFormat: GfxFormat.U16_R,
        });
        const vertexBuffers: GfxVertexBufferDescriptor[] = [
            { buffer: this.vtxBuffer, byteOffset: 0, byteStride: 4*5 },
        ];
        this.inputState = device.createInputState(this.inputLayout, vertexBuffers, { buffer: this.idxBuffer, byteOffset: 0, byteStride: 1 });
        const renderInstBuilder = renderHelper.renderInstBuilder;

        this.renderInst = renderInstBuilder.pushRenderInst();
        renderInstBuilder.newUniformBufferInstance(this.renderInst, ub_PacketParams);
        this.renderInst.drawIndexes(6);
    }

    public destroy(device: GfxDevice) {
        device.destroyBuffer(this.vtxBuffer);
        device.destroyInputLayout(this.inputLayout);
        device.destroyInputState(this.inputState);
    }
}

class SeaRenderer extends SunshineRenderer {
    public seaPlaneScene: SeaPlaneScene;

    protected prepareToRender(hostAccessPass: GfxHostAccessPass, viewerInput: ViewerRenderInput): void {
        this.seaPlaneScene.prepareToRender(this.renderHelper, viewerInput);
        super.prepareToRender(hostAccessPass, viewerInput);
    }
}

export function createSceneGfx(device: GfxDevice, name: string): Progressable<SceneGfx> {
    return fetchData("data/j3d/sms/dolpic0.szs").then((buffer: ArrayBufferSlice) => {
        return Yaz0.decompress(buffer);
    }).then((buffer: ArrayBufferSlice) => {
        const rarc = RARC.parse(buffer);

        const textureHolder = new J3DTextureHolder();
        const renderer = new SeaRenderer(device, textureHolder, rarc);
        const skyScene = SunshineSceneDesc.createSunshineSceneForBasename(device, renderer.renderHelper, textureHolder, SMSPass.SKYBOX, rarc, 'map/map/sky', true);
        renderer.modelInstances.push(skyScene);

        const bmdFile = rarc.findFile('map/map/sea.bmd');
        const btkFile = rarc.findFile('map/map/sea.btk');
        const bmd = BMD.parse(bmdFile.buffer);
        const btk = BTK.parse(btkFile.buffer);

        const seaScene = new SeaPlaneScene(device, renderer.renderHelper, textureHolder, bmd, btk, name);
        renderer.seaPlaneScene = seaScene;
        return renderer;
    });
}
