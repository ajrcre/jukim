package com.jukim.creepertrader.registry;

import com.jukim.creepertrader.CreeperTrader;
import com.jukim.creepertrader.entity.CreeperTraderEntity;
import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;

/** Registry for the mod's entity types. */
public final class ModEntities {
	private static final ResourceKey<EntityType<?>> CREEPER_TRADER_KEY =
		ResourceKey.create(Registries.ENTITY_TYPE, CreeperTrader.id("creeper_trader"));

	public static final EntityType<CreeperTraderEntity> CREEPER_TRADER = Registry.register(
		BuiltInRegistries.ENTITY_TYPE,
		CREEPER_TRADER_KEY,
		EntityType.Builder.of(CreeperTraderEntity::new, MobCategory.CREATURE)
			.sized(0.6F, 1.7F)
			.clientTrackingRange(10)
			.build(CREEPER_TRADER_KEY)
	);

	private ModEntities() {
	}

	public static void register() {
		FabricDefaultAttributeRegistry.register(CREEPER_TRADER, CreeperTraderEntity.createAttributes());
	}
}
