package com.jukim.creepertrader.entity;

import com.jukim.creepertrader.CreeperTrader;
import com.jukim.creepertrader.trade.TntTrades;
import net.minecraft.network.syncher.EntityDataAccessor;
import net.minecraft.network.syncher.EntityDataSerializers;
import net.minecraft.network.syncher.SynchedEntityData;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.stats.Stats;
import net.minecraft.util.Mth;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.AgeableMob;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.ExperienceOrb;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.ai.goal.InteractGoal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.LookAtTradingPlayerGoal;
import net.minecraft.world.entity.ai.goal.TradeWithPlayerGoal;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomStrollGoal;
import net.minecraft.world.entity.npc.villager.AbstractVillager;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.trading.MerchantOffer;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.gameevent.GameEvent;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import org.jspecify.annotations.Nullable;

/**
 * A creeper dressed as a villager. Right-click to trade emeralds for TNT.
 * Hit it and the fuse lights: it chases you and explodes like a creeper.
 */
public class CreeperTraderEntity extends AbstractVillager {
	private static final EntityDataAccessor<Boolean> DATA_IGNITED =
		SynchedEntityData.defineId(CreeperTraderEntity.class, EntityDataSerializers.BOOLEAN);
	private static final int MAX_SWELL = 30;
	private static final float EXPLOSION_RADIUS = 3.0F;

	private TraderMood mood = TraderMood.PEACEFUL;
	private int oldSwell;
	private int swell;

	public CreeperTraderEntity(EntityType<? extends CreeperTraderEntity> type, Level level) {
		super(type, level);
	}

	public static AttributeSupplier.Builder createAttributes() {
		return Mob.createMobAttributes()
			.add(Attributes.MAX_HEALTH, 20.0)
			.add(Attributes.MOVEMENT_SPEED, 0.5);
	}

	@Override
	protected void registerGoals() {
		goalSelector.addGoal(0, new FloatGoal(this));
		goalSelector.addGoal(1, new TradeWithPlayerGoal(this));
		goalSelector.addGoal(1, new LookAtTradingPlayerGoal(this));
		goalSelector.addGoal(8, new WaterAvoidingRandomStrollGoal(this, 0.35));
		goalSelector.addGoal(9, new InteractGoal(this, Player.class, 3.0F, 1.0F));
		goalSelector.addGoal(10, new LookAtPlayerGoal(this, Mob.class, 8.0F));
	}

	@Override
	protected void defineSynchedData(SynchedEntityData.Builder entityData) {
		super.defineSynchedData(entityData);
		entityData.define(DATA_IGNITED, false);
	}

	// ---- Trading ----

	@Override
	public InteractionResult mobInteract(Player player, InteractionHand hand) {
		if (!isAlive() || isTrading() || isIgnited()) {
			return super.mobInteract(player, hand);
		}
		if (hand == InteractionHand.MAIN_HAND) {
			player.awardStat(Stats.TALKED_TO_VILLAGER);
		}
		if (!level().isClientSide()) {
			if (getOffers().isEmpty()) {
				return InteractionResult.CONSUME;
			}
			setTradingPlayer(player);
			openTradingScreen(player, getDisplayName(), 1);
		}
		return InteractionResult.SUCCESS_SERVER;
	}

	@Override
	protected void updateTrades(ServerLevel level) {
		TntTrades.addAll(getOffers());
	}

	@Override
	protected void rewardTradeXp(MerchantOffer offer) {
		if (offer.shouldRewardExp()) {
			int xp = 3 + random.nextInt(4);
			level().addFreshEntity(new ExperienceOrb(level(), getX(), getY() + 0.5, getZ(), xp));
		}
	}

	@Override
	public boolean showProgressBar() {
		return false;
	}

	@Override
	public @Nullable AgeableMob getBreedOffspring(ServerLevel level, AgeableMob partner) {
		return null;
	}

	// ---- Fuse / explosion ----

	@Override
	public boolean hurtServer(ServerLevel level, DamageSource source, float damage) {
		if (source.getEntity() instanceof Player attacker) {
			mood = mood.onHurtByPlayer(this, attacker);
		}
		return super.hurtServer(level, source, damage);
	}

	void ignite(Player attacker) {
		CreeperTrader.LOGGER.info("Creeper trader ignited, attacker={}", attacker.getName().getString());
		setTradingPlayer(null);
		setTarget(attacker);
		entityData.set(DATA_IGNITED, true);
	}

	public boolean isIgnited() {
		return entityData.get(DATA_IGNITED);
	}

	/** 0..1 progress used by the renderer for the swell and white flash. */
	public float getSwelling(float partialTicks) {
		return Mth.lerp(partialTicks, oldSwell, swell) / (MAX_SWELL - 2);
	}

	@Override
	public void tick() {
		if (isAlive()) {
			oldSwell = swell;
			if (isIgnited()) {
				if (swell == 0) {
					playSound(SoundEvents.CREEPER_PRIMED, 1.0F, 0.5F);
					gameEvent(GameEvent.PRIME_FUSE);
				}
				swell++;
				if (swell >= MAX_SWELL) {
					swell = MAX_SWELL;
					explode();
				}
			}
		}
		super.tick();
	}

	@Override
	public void aiStep() {
		super.aiStep();
		if (!level().isClientSide() && isAlive()) {
			mood = mood.tick(this);
		}
	}

	private void explode() {
		if (level() instanceof ServerLevel level) {
			CreeperTrader.LOGGER.info("Creeper trader exploded, x={}, y={}, z={}", getBlockX(), getBlockY(), getBlockZ());
			dead = true;
			level.explode(this, getX(), getY(), getZ(), EXPLOSION_RADIUS, Level.ExplosionInteraction.MOB);
			triggerOnDeathMobEffects(level, Entity.RemovalReason.KILLED);
			discard();
		}
	}

	// ---- Save data ----

	@Override
	protected void addAdditionalSaveData(ValueOutput output) {
		super.addAdditionalSaveData(output);
		output.putBoolean("ignited", isIgnited());
	}

	@Override
	protected void readAdditionalSaveData(ValueInput input) {
		super.readAdditionalSaveData(input);
		if (input.getBooleanOr("ignited", false)) {
			entityData.set(DATA_IGNITED, true);
			mood = new TraderMood.Fuse();
		}
	}

	// ---- Sounds ----

	@Override
	protected SoundEvent getAmbientSound() {
		return isTrading() ? SoundEvents.VILLAGER_TRADE : SoundEvents.VILLAGER_AMBIENT;
	}

	@Override
	protected SoundEvent getHurtSound(DamageSource source) {
		return SoundEvents.CREEPER_HURT;
	}

	@Override
	protected SoundEvent getDeathSound() {
		return SoundEvents.CREEPER_DEATH;
	}

	@Override
	protected SoundEvent getTradeUpdatedSound(boolean validTrade) {
		return validTrade ? SoundEvents.VILLAGER_YES : SoundEvents.VILLAGER_NO;
	}

	@Override
	public SoundEvent getNotifyTradeSound() {
		return SoundEvents.VILLAGER_YES;
	}
}
