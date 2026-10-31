package com.jukim.creepertrader.client;

import com.jukim.creepertrader.CreeperTrader;
import net.minecraft.client.model.geom.ModelLayerLocation;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeDeformation;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
import net.minecraft.client.model.monster.creeper.CreeperModel;

/** Vanilla creeper body plus a villager robe, nose and straw hat brim. */
public class CreeperTraderModel extends CreeperModel {
	public static final ModelLayerLocation LAYER = new ModelLayerLocation(CreeperTrader.id("creeper_trader"), "main");

	public CreeperTraderModel(ModelPart root) {
		super(root);
	}

	public static LayerDefinition createBodyLayer() {
		MeshDefinition mesh = new MeshDefinition();
		PartDefinition root = mesh.getRoot();
		CubeDeformation none = CubeDeformation.NONE;

		PartDefinition head = root.addOrReplaceChild("head",
			CubeListBuilder.create().texOffs(0, 0).addBox(-4.0F, -8.0F, -4.0F, 8.0F, 8.0F, 8.0F, none),
			PartPose.offset(0.0F, 6.0F, 0.0F));
		// Villager nose
		head.addOrReplaceChild("nose",
			CubeListBuilder.create().texOffs(28, 32).addBox(-1.0F, -3.0F, -6.0F, 2.0F, 4.0F, 2.0F),
			PartPose.ZERO);
		// Straw hat crown
		head.addOrReplaceChild("hat",
			CubeListBuilder.create().texOffs(32, 0).addBox(-4.0F, -10.0F, -4.0F, 8.0F, 4.0F, 8.0F, new CubeDeformation(0.3F)),
			PartPose.ZERO);
		// Straw hat brim
		head.addOrReplaceChild("hat_rim",
			CubeListBuilder.create().texOffs(30, 47).addBox(-8.0F, -8.0F, -6.0F, 16.0F, 16.0F, 1.0F),
			PartPose.rotation((float) (-Math.PI / 2), 0.0F, 0.0F));

		PartDefinition body = root.addOrReplaceChild("body",
			CubeListBuilder.create().texOffs(16, 16).addBox(-4.0F, 0.0F, -2.0F, 8.0F, 12.0F, 4.0F, none),
			PartPose.offset(0.0F, 6.0F, 0.0F));
		// Villager robe over the body
		body.addOrReplaceChild("robe",
			CubeListBuilder.create().texOffs(0, 32).addBox(-4.0F, 0.0F, -2.5F, 8.0F, 14.0F, 5.0F, new CubeDeformation(0.5F)),
			PartPose.ZERO);

		CubeListBuilder leg = CubeListBuilder.create().texOffs(0, 16).addBox(-2.0F, 0.0F, -2.0F, 4.0F, 6.0F, 4.0F, none);
		root.addOrReplaceChild("right_hind_leg", leg, PartPose.offset(-2.0F, 18.0F, 4.0F));
		root.addOrReplaceChild("left_hind_leg", leg, PartPose.offset(2.0F, 18.0F, 4.0F));
		root.addOrReplaceChild("right_front_leg", leg, PartPose.offset(-2.0F, 18.0F, -4.0F));
		root.addOrReplaceChild("left_front_leg", leg, PartPose.offset(2.0F, 18.0F, -4.0F));
		return LayerDefinition.create(mesh, 64, 64);
	}
}
