import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { OpenVidu, Session, Publisher, LocalRecorder } from 'openvidu-browser';

import { VideoSessionService } from '../../services/video-session.service';
import { AuthenticationService } from '../../services/authentication.service';

import { Lesson } from '../../models/lesson';

@Component({
    selector: 'app-video-session',
    templateUrl: './video-session.component.html',
    styleUrls: ['./video-session.component.css']
})
export class VideoSessionComponent implements OnInit {

    lesson: Lesson;

    OV: OpenVidu;
    session: Session;
    publisher: Publisher;
    recorder: LocalRecorder;

    sessionId: string;
    token: string;

    isTeacher: boolean;

    cameraOptions: any;

    localVideoActivated: boolean;
    localAudioActivated: boolean;
    videoIcon: string;
    audioIcon: string;
    recordIcon: string;
    fullscreenIcon: string;

    constructor(
        private location: Location,
        private authenticationService: AuthenticationService,
        private videoSessionService: VideoSessionService) { }


    OPEN_VIDU_CONNECTION() {

        // 0) Obtain 'sessionId' and 'token' from server
        // In this case, the method ngOnInit takes care of it


        // 1) Initialize OpenVidu and your Session
        this.OV = new OpenVidu();
        this.session = this.OV.initSession(this.sessionId);


        // 2) Specify the actions when events take place
        this.session.on('streamCreated', (event) => {
            console.warn("STREAM CREATED!");
            console.warn(event.stream);
            this.session.subscribe(event.stream, 'subscriber', {
                insertMode: 'append',
                width: '100%',
                height: '100%'
            });
        });

        this.session.on('streamDestroyed', (event) => {
            console.warn("STREAM DESTROYED!");
            console.warn(event.stream);
        });


        this.session.on('connectionCreated', (event) => {
            if (event.connection.connectionId == this.session.connection.connectionId) {
                console.warn("YOUR OWN CONNECTION CREATED!");
            } else {
                console.warn("OTHER USER'S CONNECTION CREATED!");
            }
            console.warn(event.connection);
        });

        this.session.on('connectionDestroyed', (event) => {
            console.warn("OTHER USER'S CONNECTION DESTROYED!");
            console.warn(event.connection);
        });


        // 3) Connect to the session
        this.session.connect(this.token, "CLIENT:" + this.authenticationService.getCurrentUser().name, (error) => {

            // If the connection is successful, initialize a publisher and publish to the session
            if (!error) {

                if (this.authenticationService.isTeacher()) {

                    // 4) Get your own camera stream with the desired resolution and publish it, only if the user is supposed to do so
                    this.publisher = this.OV.initPublisher('publisher', this.cameraOptions);

                    this.publisher.on('accessAllowed', () => {
                        console.warn("CAMERA ACCESS ALLOWED!");
                    });
                    this.publisher.on('accessDenied', () => {
                        console.warn("CAMERA ACCESS DENIED!");
                    });
                    this.publisher.on('streamCreated', (event) => {
                        console.warn("STREAM CREATED BY PUBLISHER!");
                        console.warn(event.stream);

                        if (this.authenticationService.isTeacher()) {
                            console.warn("TEACHER HAS A RECORDER!");
                            this.recorder = this.OV.initLocalRecorder(event.stream);
                        }
                    })

                    // 5) Publish your stream
                    this.session.publish(this.publisher);

                }

            } else {
                console.log('There was an error connecting to the session:', error.code, error.message);
            }
        });
    }


    ngOnInit() {

        this.isTeacher = this.authenticationService.isTeacher();

        // Specific aspects of this concrete application
        this.previousConnectionStuff();


        if (this.authenticationService.isTeacher()) {

            // If the user is the teacher: creates the session and gets a token (with PUBLISHER role)
            this.videoSessionService.createSession(this.lesson.id).subscribe(
                sessionId => { // {0: sessionId}
                    this.sessionId = sessionId[0];
                    this.videoSessionService.generateToken(this.lesson.id).subscribe(
                        sessionIdAndToken => {
                            this.token = sessionIdAndToken[1];
                            console.warn("Token: " + this.token);
                            console.warn("SessionId: " + this.sessionId);
                            this.OPEN_VIDU_CONNECTION();
                        },
                        error => {
                            console.log(error);
                        });
                },
                error => {
                    console.log(error);
                }
            );
        }
        else {

            // If the user is a student: gets a token (with SUBSCRIBER role)
            this.videoSessionService.generateToken(this.lesson.id).subscribe(
                sessionIdAndToken => { // {0: sessionId, 1: token}
                    this.sessionId = sessionIdAndToken[0];
                    this.token = sessionIdAndToken[1];
                    console.warn("Token: " + this.token);
                    console.warn("SessionId: " + this.sessionId);
                    this.OPEN_VIDU_CONNECTION();
                },
                error => {
                    console.log(error);
                });
        }


        // Specific aspects of this concrete application
        this.afterConnectionStuff();
    }

    ngAfterViewInit() {
        this.toggleScrollPage("hidden");
    }

    ngOnDestroy() {
        this.videoSessionService.removeUser(this.lesson.id).subscribe(
            response => {
                console.warn("You have succesfully left the lesson");
            },
            error => {
                console.log(error);
            });
        this.toggleScrollPage("auto");
        this.exitFullScreen();
        if (this.OV) this.session.disconnect();
    }

    toggleScrollPage(scroll: string) {
        let content = <HTMLElement>document.getElementsByClassName("mat-sidenav-content")[0];
        content.style.overflow = scroll;
    }

    getRecorderColor() {
        if (this.recorder != null) {
            if (this.recorder.state == "RECORDING" || this.recorder.state == "PAUSED") {
                return "cyan";
            }
        }
        return "white";
    }

    toggleLocalRecorder() {
        if (this.recorder != null) {
            if (this.recorder.state == "READY") {
                console.warn("START RECORDING ...");
                this.recorder.record();
                this.recordIcon = "fiber_smart_record";
            } else if (this.recorder.state == "RECORDING" || this.recorder.state == "PAUSED") {
                console.warn("STOP RECORDING ...");
                this.recorder.stop().then(() => {
                    console.warn("STOPPED, recorder.state >" + this.recorder.state);
                    this.recorder.download();
                    this.recordIcon = "fiber_manual_record";
                });
            } else if (this.recorder.state == "FINISHED") {
                console.warn("CLEAN THE RECORDER & RECORD");
                this.recorder.clean();
                this.recorder.record();
                this.recordIcon = "fiber_smart_record";
            }
        } else {
            console.warn("NONE RECORDER OBJECT");
        }
    }

    toggleLocalVideo() {
        this.localVideoActivated = !this.localVideoActivated;
        this.publisher.publishVideo(this.localVideoActivated);
        this.videoIcon = this.localVideoActivated ? 'videocam' : 'videocam_off';
    }

    toggleLocalAudio() {
        this.localAudioActivated = !this.localAudioActivated;
        this.publisher.publishAudio(this.localAudioActivated);
        this.audioIcon = this.localAudioActivated ? 'mic' : 'mic_off';
    }

    toggleFullScreen() {
        let document: any = window.document;
        let fs = document.getElementsByTagName('html')[0];
        if (!document.fullscreenElement &&
            !document.mozFullScreenElement &&
            !document.webkitFullscreenElement &&
            !document.msFullscreenElement) {
            console.log("enter FULLSCREEN!");
            this.fullscreenIcon = 'fullscreen_exit';
            if (fs.requestFullscreen) {
                fs.requestFullscreen();
            } else if (fs.msRequestFullscreen) {
                fs.msRequestFullscreen();
            } else if (fs.mozRequestFullScreen) {
                fs.mozRequestFullScreen();
            } else if (fs.webkitRequestFullscreen) {
                fs.webkitRequestFullscreen();
            }
        } else {
            console.log("exit FULLSCREEN!");
            this.fullscreenIcon = 'fullscreen';
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    }

    exitFullScreen() {
        let document: any = window.document;
        let fs = document.getElementsByTagName('html')[0];
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }

    previousConnectionStuff() {
        this.lesson = this.videoSessionService.lesson;
        this.cameraOptions = this.videoSessionService.cameraOptions;
    }

    afterConnectionStuff() {
        this.localVideoActivated = this.cameraOptions.video;
        this.localAudioActivated = this.cameraOptions.audio;
        this.videoIcon = this.localVideoActivated ? "videocam" : "videocam_off";
        this.audioIcon = this.localAudioActivated ? "mic" : "mic_off";
        this.recordIcon = this.recorder != null && this.recorder.state == "RECORDING" ? "fiber_smart_record" : "fiber_manual_record";
        this.fullscreenIcon = "fullscreen";
    }

}
