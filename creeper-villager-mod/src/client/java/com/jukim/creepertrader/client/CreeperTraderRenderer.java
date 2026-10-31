package com.jukim.creepertrader.client;

import com.jukim.creepertrader.CreeperTrader;
import com.jukim.creepertrader.entity.CreeperTraderEntity;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.MobRenderer;
import net.minecraft.client.renderer.entity.state.CreeperRenderState;
import net.minecraft.resources.Identifier;
import net.minecraft.util.Mth;

/** Renders the trader with creeper-style swelling and white flashing while the fuse burns. */
public class CreeperTraderRenderer extends MobRenderer<CreeperTraderEntity, CreeperRenderState, CreeperTraderModel> {
	private static final Identifier TEXTURE = CreeperTrader.id("textures/entity/creeper_trader.png");

	public CreeperTraderRenderer(EntityRendererProvider.Context context) {
		super(context, new CreeperTraderModel(context.bakeLayer(CreeperTraderModel.LAYER)), 0.5F);
	}

	@Override
	protected void scale(CreeperRenderState state, PoseStack poseStack) {
		float g = state.swelling;
		float wobble = 1.0F + Mth.sin(g * 100.0F) * g * 0.01F;
		g = Mth.clamp(g, 0.0F, 1.0F);
		g *= g;
		g *= g;
		float s = (1.0F + g * 0.4F) * wobble;
		float hs = (1.0F + g * 0.1F) / wobble;
		poseStack.scale(s, hs, s);
	}

	@Override
	protected float getWhiteOverlayProgress(CreeperRenderState state) {
		float step = state.swelling;
		return (int) (step * 10.0F) % 2 == 0 ? 0.0F : Mth.clamp(step, 0.5F, 1.0F);
	}

	@Override
	public Identifier getTextureLocation(CreeperRenderState state) {
		return TEXTURE;
	}

	@Override
	public CreeperRenderState createRenderState() {
		return new CreeperRenderState();
	}

	@Override
	public void extractRenderState(CreeperTraderEntity entity, CreeperRenderState state, float partialTicks) {
		super.extractRenderState(entity, state, partialTicks);
		state.swelling = entity.getSwelling(partialTicks);
		state.isPowered = false;
	}
}
