let oldCharts = [];
let animatorId = 0;

function renderChart(data, labels, name, id, options) {
    var ctx = document.getElementById(id).getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: name,
                data: data,
            }]
        },
        options: options,
    });
    return myChart;
}

$("#generateBtn").click(() => renderCharts());
$(".profile_params").change(() => renderCharts());

function renderCharts() {
    oldCharts.forEach(chart => chart.destroy());
    clearInterval(animatorId);

    let profile = motionProfile(new Profile(
        +$("#dt").val(),
        +$("#start_pos").val(), 
        +$("#end_pos").val(), 
        +$("#start_vel").val(), 
        +$("#end_vel").val(), 
        +$("#max_vel").val(), 
        +$("#max_accel").val()));

    let positionChartOptions = 
          {
            animation: {
                duration: 0 // general animation time
            },
            hover: {
                animationDuration: 0 // duration of animations when hovering an item
            },
            scales: {
              xAxes: [{
                ticks: {
                  min: 0,
                  max: profile.positions.trajectory_time,
                  stepSize: profile.dt,
                },
              }],
              yAxes: [{
                ticks: {
                  min: profile.start_pos,
                  max: profile.end_pos,
                  stepSize: 5 /*(profile.end_pos - profile.start_pos) / profile.positions.trajectory.length*/,
                },
              }],
            },
            responsiveAnimationDuration: 0, // animation duration after a resize
          };

    let velocityChartOptions = 
            {
              animation: {
                  duration: 0 // general animation time
              },
              hover: {
                  animationDuration: 0 // duration of animations when hovering an item
              },
              scales: {
                xAxes: [{
                  ticks: {
                    min: 0,
                    max: profile.velocities.trajectory_time,
                    stepSize: profile.dt,
                  },
                }],
                yAxes: [{
                  ticks: {
                    min: profile.min_vel,
                    max: profile.max_vel,
                    stepSize: 5 /*(profile.end_vel - profile.start_vel) / profile.velocities.trajectory.length*/,
                  },
                }],
              },
              responsiveAnimationDuration: 0, // animation duration after a resize
            };

    console.log(profile.positions.trajectory_time);
    let positionChart = renderChart([], [], "Position", "positionChart", positionChartOptions);
    let velocityChart = renderChart([], [], "Velocity", "velocityChart", velocityChartOptions);

    animatorId = setInterval((function(){
      if(profile.positions.trajectory.length == 0 && profile.velocities.trajectory.length == 0) {
            clearInterval(animatorId);
            return;
      }
      
      let position = profile.positions.trajectory.shift();
      let velocity = profile.velocities.trajectory.shift();

      positionChart.data.datasets.forEach((dataset) => dataset.data.push(position.value));
      velocityChart.data.datasets.forEach((dataset) => dataset.data.push(velocity.value));

      positionChart.data.labels.push(position.time);
      velocityChart.data.labels.push(velocity.time)

      positionChart.update(0);
      velocityChart.update(0);
    }), profile.dt * 1000.0);

    oldCharts = [positionChart, velocityChart];
}

function motionProfile(profile) {
    let velocities = [];
    let positions = [];
    let current_vel = profile.start_vel;
  	let current_pos = profile.start_pos;
  	let accel_scalar = 1.0;
    let time = 0.0;
  
  	while(profile.end_pos - current_pos > 0.0) { 
      // We update the trajectory arrays first so we don't lose the first trajectory point
      velocities.push({time: time, value: current_vel});
      positions.push({time: time, value: current_pos});

      // Reset acceleration scalar so we don't accidentally start cruising and so we can re-validate things below
      accel_scalar = 1.0;
      // Calculate where we would stop if we started deceleration now
      let pos_after_decel = current_pos + ((profile.end_vel * profile.end_vel) - (current_vel * current_vel)) / (2.0 * -profile.max_accel);
      // Calculate what our velocity would be with acceleration applied
      let vel_with_accel = current_vel + (accel_scalar * profile.max_accel * profile.dt);

      // If we would stop before or at the target position, keep accelerating
      if(pos_after_decel <= profile.end_pos) {
        // If applying acceleration will put us above our maximum velocity, stop accelerating (this effectively makes the update below vf = vi + v*t and xf = xi + v*t)
        if(vel_with_accel >= profile.max_vel) {
          accel_scalar = 0.0;
        } else {
          accel_scalar = 1.0;
        }
      } else {
        // If we want to start decelerating, simply flip the sign of acceleration
      	accel_scalar = -1.0;
      }
      
      // Update velocity based on current acceleration
      current_vel = current_vel + (accel_scalar * profile.max_accel * profile.dt);
      // Update position based on current velocity
      current_pos = current_pos + (current_vel * profile.dt) + (0.5 * accel_scalar * profile.max_accel * profile.dt * profile.dt);
      time += profile.dt;
    }
    profile.positions = new Trajectory(positions, dt);
    profile.velocities = new Trajectory(velocities, dt);
    return profile;
}

class Profile {
  constructor(dt, start_pos, end_pos, start_vel, end_vel, max_vel, max_accel) {
    this.dt = dt;
    this.start_pos = start_pos;
    this.end_pos = end_pos;
    this.start_vel = start_vel;
    this.end_vel = end_vel;
    this.max_vel = max_vel;
    this.max_accel = max_accel;
    this.positions = null;
    this.velocities = null;
  }
}

class Trajectory {

  constructor(trajectory, dt) {
    this.trajectory = trajectory;
    this.dt = dt;
    this.trajectory_time = trajectory[trajectory.length - 1].time;
    this.start_time = 0;
  }
  
  start(time) {
    reset(time);
  }

  reset() {
    reset(0);
  }

  reset(time) {
    this.start_time = time;
  }

  get(time) {
    if(time > this.start_time + this.trajectory_time || time < this.start_time) {
    	return 0.0;
    }
    // Calculate the integer index of the trajectory point based off of start time, current time, and dt
        // This is a hilariously bad way of getting a trajectory point but it's way easier than interpolating
    let index = Math.round((time - this.start_time) / this.dt);
    return this.trajectory[index];
  }

  get_timestamps() {
    let times = [];
    for(let time = this.start_time; time <= this.trajectory_time; time += this.dt) {
      times.push(time);
    }
    return times;
  }

}